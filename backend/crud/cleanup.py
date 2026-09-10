from datetime import datetime, timedelta, timezone
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.models import Flag, Environment, EnvironmentFlagOverride
from backend.models import CleanupCandidate, AdminSetting
from backend.models import AuditLog


def _utc_aware(value: datetime | None) -> datetime:
    """Normalize model timestamps for safe comparisons with timestamptz columns."""
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# Helper to read admin setting or default
def get_threshold_days(db: Session, default: int = 30) -> int:
    setting = db.query(AdminSetting).filter(AdminSetting.key == "cleanup_threshold_days").first()
    if not setting or not setting.value:
        return default
    try:
        return int(setting.value)
    except Exception:
        return default


def _compute_flag_env_status(flag: Flag, env_map: dict, overrides_by_flag: dict) -> Tuple[bool, bool]:
    """Return tuple (all_environments_fully_rolled_out, all_environments_fully_disabled)
    """
    env_ids = list(env_map.keys())
    all_rolled_out = True
    all_disabled = True

    overrides = overrides_by_flag.get(flag.id, [])
    # Build a map by environment_id
    overrides_map = {ov.environment_id: ov for ov in overrides}

    for env_id, env in env_map.items():
        # Determine resolved enabled and rollout for this env
        ov = overrides_map.get(env_id)
        if ov is not None:
            enabled = bool(ov.resolved_value)
            rollout = ov.rollout_percentage if ov.rollout_percentage is not None else (flag.rollout_percentage or 100)
        else:
            enabled = bool(flag.enabled)
            rollout = flag.rollout_percentage or 100

        if not (enabled and int(rollout) >= 100):
            all_rolled_out = False
        if enabled:
            # If enabled anywhere, it's not fully disabled
            all_disabled = False

    return all_rolled_out, all_disabled


def scan_cleanup_candidates(db: Session, owner_user_id: Optional[int] = None) -> Tuple[int, List[CleanupCandidate]]:
    """Scan flags and create/update cleanup_candidates.

    Returns (number_of_candidates, [candidates])
    """
    threshold_days = get_threshold_days(db)
    now = datetime.now(timezone.utc)
    # Load only active environments owned by the same user. Mixing tenants here can
    # incorrectly mark a flag stale because unrelated environments are considered.
    env_query = db.query(Environment).filter(Environment.is_active == True)
    if owner_user_id is not None:
        env_query = env_query.filter(Environment.owner_id == owner_user_id)
    envs = env_query.all()
    env_map = {env.id: env for env in envs}

    if not env_map:
        # No environments -> nothing eligible
        # Optionally we could clear existing candidates for safety
        return 0, []

    # Load flags
    flag_query = db.query(Flag)
    if owner_user_id is not None:
        flag_query = flag_query.filter(Flag.owner_id == owner_user_id)
    flags = flag_query.all()
    flag_ids = [f.id for f in flags]

    # Load overrides for all flags in one query
    overrides = db.query(EnvironmentFlagOverride).filter(EnvironmentFlagOverride.flag_id.in_(flag_ids)).all() if flag_ids else []
    overrides_by_flag = {}
    for ov in overrides:
        overrides_by_flag.setdefault(ov.flag_id, []).append(ov)

    found_candidates = []

    # For efficiency, bulk query existing candidates
    existing_by_flag = {c.flag_id: c for c in db.query(CleanupCandidate).filter(CleanupCandidate.flag_id.in_(flag_ids)).all()} if flag_ids else {}

    for flag in flags:
        all_rolled_out, all_disabled = _compute_flag_env_status(flag, env_map, overrides_by_flag)
        is_candidate = False
        candidate_type = None
        if all_rolled_out:
            is_candidate = True
            candidate_type = "fully_rolled_out"
        elif all_disabled:
            is_candidate = True
            candidate_type = "fully_disabled"

        existing = existing_by_flag.get(flag.id)
        if is_candidate:
            if existing:
                # Preserve the first date on which the current stale state became eligible.
                changed = False
                state_since = _utc_aware(getattr(flag, "updated_at", None))
                if existing.candidate_type != candidate_type:
                    existing.candidate_type = candidate_type
                    existing.eligible_since = state_since
                    existing.reviewed = False
                    existing.reviewed_by = None
                    existing.reviewed_at = None
                    existing.review_note = None
                    changed = True
                elif not existing.eligible_since:
                    existing.eligible_since = state_since
                    changed = True
                if changed:
                    existing.updated_at = now
                    db.add(existing)
                    db.commit()
                    db.refresh(existing)
                found_candidates.append(existing)
            else:
                # Create a new candidate and set eligible_since to now
                cand = CleanupCandidate(
                    flag_id=flag.id,
                    candidate_type=candidate_type,
                    eligible_since=_utc_aware(getattr(flag, "updated_at", None)),
                    reviewed=False,
                )
                db.add(cand)
                db.commit()
                db.refresh(cand)
                found_candidates.append(cand)
        else:
            # Not a candidate now — if existing candidate exists, remove it
            if existing:
                db.delete(existing)
                db.commit()

    # After creating/updating, filter by threshold_days: only return candidates older than threshold
    cutoff = now - timedelta(days=threshold_days)
    eligible_candidates = [c for c in found_candidates if _utc_aware(c.eligible_since) <= cutoff]

    return len(eligible_candidates), eligible_candidates


def list_cleanup_candidates(db: Session, page: int = 1, size: int = 20, search: Optional[str] = None,
                            candidate_type: Optional[str] = None, reviewed: Optional[bool] = None,
                            owner_user_id: Optional[int] = None):
    query = db.query(CleanupCandidate).join(Flag, CleanupCandidate.flag_id == Flag.id)
    cutoff = datetime.now(timezone.utc) - timedelta(days=get_threshold_days(db))
    query = query.filter(CleanupCandidate.eligible_since <= cutoff)
    if owner_user_id is not None:
        query = query.filter(Flag.owner_id == owner_user_id)
    if search:
        # join flags to search by flag key
        query = query.filter(Flag.key.ilike(f"%{search}%"))
    if candidate_type:
        query = query.filter(CleanupCandidate.candidate_type == candidate_type)
    if reviewed is not None:
        query = query.filter(CleanupCandidate.reviewed == reviewed)

    total = query.count()
    items = query.order_by(CleanupCandidate.eligible_since.desc()).offset((page - 1) * size).limit(size).all()
    return total, items


def mark_candidate_reviewed(db: Session, flag_id: int, reviewer_user_id: int, note: Optional[str] = None) -> CleanupCandidate:
    cand = (db.query(CleanupCandidate)
            .join(Flag, CleanupCandidate.flag_id == Flag.id)
            .filter(CleanupCandidate.flag_id == flag_id, Flag.owner_id == reviewer_user_id)
            .first())
    if not cand:
        return None
    cand.reviewed = True
    cand.reviewed_by = reviewer_user_id
    cand.reviewed_at = datetime.now(timezone.utc)
    if note:
        cand.review_note = note

    db.add(cand)
    db.commit()
    db.refresh(cand)

    # Write an audit log entry
    audit = AuditLog(
        action="review_cleanup_candidate",
        entity_type="flag",
        entity_id=flag_id,
        entity_name=None,
        actor=str(reviewer_user_id),
        environment=None,
        field_changed="cleanup_review",
        old_value=None,
        new_value=str({"reviewed_by": reviewer_user_id, "note": note}),
        owner_user_id=reviewer_user_id,
    )
    db.add(audit)
    db.commit()

    return cand
