from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_
from sqlalchemy.orm import Session

from backend.crud import audit_log as audit_crud
from backend.crud import flag as flag_crud
from backend.crud import flag_target_groups as target_group_crud
from backend.crud import flag_target_users as target_user_crud
from backend.crud.user_group import get_group_by_name
from backend.database import get_db
from backend.models.environment import Environment
from backend.models.environment_flag_override import EnvironmentFlagOverride
from backend.models.cleanup_candidate import CleanupCandidate
from backend.models.evaluation_metric import EvaluationMetric
from backend.models.flag_history import FlagHistory
from backend.models.flag_target_group import FlagTargetGroup
from backend.models.flag_target_user import FlagTargetUser
from backend.models.flag_version import FlagVersion
from backend.models.targeting_rule import TargetingRule
from backend.models.user import User
from backend.schemas.flag import Flag, FlagCreate, FlagDetail, RolloutUpdate, StatusUpdate
from backend.schemas.flag_target_group import FlagTargetGroupCreate
from backend.schemas.target_user import TargetUserCreate
from backend.schemas.flag_history import FlagHistoryEntry
from backend.services.audit_service import diff_fields, flag_snapshot, record_event
from backend.services.cache import cache_service
from backend.services.evaluation_service import EvaluationService
from backend.utils.deps import get_current_user

router = APIRouter(prefix="/flags", tags=["flags"])


class FlagEnvironmentOverrideInput(BaseModel):
    enabled: bool | None = None
    value: bool | None = None
    rollout_percentage: int | None = Field(default=None, ge=0, le=100)


def _flag_actor(data, current_user):
    return getattr(data, "actor", None) or getattr(current_user, "email", None) or "system"


def _log_flag_event(database, flag, *, action: str, actor: str, details: str, event: str | None = None, snapshot: bool = True, field_changed: str | None = None, old_value=None, new_value=None):
    record_event(
        database,
        flag,
        event=event or action,
        action=action,
        actor=actor,
        details=details,
        snapshot=snapshot,
        changes_summary=details,
        field_changed=field_changed,
        old_value=old_value,
        new_value=new_value,
    )


def _log_flag_diff(database, before, after, *, actor: str, action: str = "updated"):
    before_snapshot = flag_snapshot(before)
    after_snapshot = flag_snapshot(after)
    changes = diff_fields(before_snapshot, after_snapshot)
    if not changes:
        _log_flag_event(
            database,
            after,
            action=action,
            actor=actor,
            details=f"No changes recorded for flag {after.key}",
            event=action,
        )
        return

    for field_name, old_value, new_value in changes:
        _log_flag_event(
            database,
            after,
            action=action,
            actor=actor,
            details=f"{field_name} changed on flag {after.key}",
            event=action,
            field_changed=field_name,
            old_value=old_value,
            new_value=new_value,
        )


def _flag_target_users_payload(database, flag_id: int) -> list[str]:
    rows = target_user_crud.get_target_users_by_flag_id(database, flag_id)
    return [row.user_id for row in rows]


def _flag_target_groups_payload(database, flag_id: int) -> list[str]:
    return target_group_crud.get_target_group_names_by_flag_id(database, flag_id)


def _invalidate_flag_cache(flag_key: str):
    cache_service.invalidate_flag(flag_key)


@router.get("", response_model=list[Flag])
def list_flags(
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return flag_crud.get_flags(database, owner_id=current_user.id)


@router.post("", response_model=Flag, status_code=status.HTTP_201_CREATED)
def create_flag(
    data: FlagCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        flag = flag_crud.create_flag(database, data, owner_id=current_user.id)
        _invalidate_flag_cache(flag.key)
        _log_flag_event(
            database,
            flag,
            action="created",
            actor=_flag_actor(data, current_user),
            details=f"Created flag {flag.key}",
            event="created",
        )
        return flag
    except IntegrityError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A feature flag with this key already exists. Use a unique flag key.",
        )


@router.get("/{flag_id}/details", response_model=FlagDetail)
def get_flag_details(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    target_users = _flag_target_users_payload(database, flag.id)
    target_groups = _flag_target_groups_payload(database, flag.id)

    override_rows = (
        database.query(EnvironmentFlagOverride, Environment)
        .join(Environment, Environment.id == EnvironmentFlagOverride.environment_id)
        .filter(EnvironmentFlagOverride.flag_id == flag.id)
        .all()
    )

    rollout_percentage = getattr(flag, "rollout_percentage", 100)
    try:
        rollout_percentage = int(rollout_percentage)
    except (TypeError, ValueError):
        rollout_percentage = 100
    rollout_percentage = max(0, min(100, rollout_percentage))

    # If explicit target users configured, evaluate each user to build exact enabled/disabled lists.
    service = EvaluationService(database)
    included_user_ids: list[str] = []
    excluded_user_ids: list[str] = []

    if target_users:
        for uid in target_users:
            try:
                result = service.evaluate(flag.key, flag.environment, user_id=str(uid))
                if result.get("value"):
                    included_user_ids.append(str(uid))
                else:
                    excluded_user_ids.append(str(uid))
            except Exception:
                # On evaluation failure, conservatively treat as excluded
                excluded_user_ids.append(str(uid))
        total_users = len(target_users)
        included_users = len(included_user_ids)
        excluded_users = len(excluded_user_ids)
    else:
        # No explicit target users: fall back to approximate counts based on rollout percentage
        total_users = database.query(User).filter(User.is_active == True).count()
        included_users = (total_users * rollout_percentage) // 100
        excluded_users = max(total_users - included_users, 0)

    response = {
        "id": flag.id,
        "key": flag.key,
        "name": getattr(flag, "name", None),
        "type": flag.type,
        "default_value": flag.default_value,
        "description": flag.description,
        "owner_team": flag.owner_team,
        "enabled": flag.enabled,
        "environment": flag.environment,
        "rollout_percentage": rollout_percentage,
        "tags": getattr(flag, "tags", []) or [],
        "dependencies": getattr(flag, "dependencies", []) or [],
        "linked_experiments": getattr(flag, "linked_experiments", []) or [],
        "created_by": getattr(flag, "created_by", None),
        "updated_by": getattr(flag, "updated_by", None),
        "created_at": getattr(flag, "created_at", None),
        "updated_at": getattr(flag, "updated_at", None),
        "versions": [],
        "audit_logs": (lambda r: r["items"] if isinstance(r, dict) else r)(audit_crud.get_audit_logs(database, owner_user_id=current_user.id, entity_type="flag", entity_id=flag.id)),

        "history": [],
        "target_users": target_users,
        "target_groups": target_groups,
        "total_users": total_users,
        "included_users": included_users,
        "excluded_users": excluded_users,
        "environment_configs": [
            {
                "environment": environment.key or environment.name,
                "value": bool(getattr(override, "value", True)),
                "enabled": bool(getattr(override, "enabled", True)),
                "rollout_percentage": getattr(override, "rollout_percentage", None),
                "is_override": True,
            }
            for override, environment in override_rows
        ]
        or [
            {
                "environment": flag.environment,
                "value": flag.default_value if flag.type == "boolean" else None,
                "rollout_percentage": rollout_percentage,
                "is_override": False,
            }
        ],
    }

    # Include lists of user ids when we evaluated explicit target users so the UI can render them directly
    if target_users:
        response["included_user_ids"] = included_user_ids
        response["excluded_user_ids"] = excluded_user_ids

    return response


@router.get("/{flag_id}/history", response_model=list[FlagHistoryEntry])
def get_flag_history(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    rows = (
        database.query(FlagHistory)
        .filter(FlagHistory.flag_id == flag_id)
        .order_by(FlagHistory.created_at.desc())
        .all()
    )
    return rows


@router.get("/{flag_id}", response_model=Flag)
def get_flag(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag


@router.put("/{flag_id}", response_model=Flag)
def update_flag(
    flag_id: int,
    data: FlagCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    before = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if before is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    try:
        flag = flag_crud.update_flag(database, flag_id, data, owner_id=current_user.id)
    except IntegrityError:
        database.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A feature flag with this key already exists. Use a unique flag key.",
        )
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    _invalidate_flag_cache(flag.key)
    _log_flag_diff(database, before, flag, actor=_flag_actor(data, current_user), action="updated")
    return flag


@router.patch("/{flag_id}/status", response_model=Flag)
def update_flag_status(
    flag_id: int,
    data: StatusUpdate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    previous_enabled = flag.enabled
    flag.enabled = data.enabled
    database.commit()
    database.refresh(flag)
    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="enabled" if flag.enabled else "disabled",
        actor=_flag_actor(data, current_user),
        details=f"Flag {flag.key} {'enabled' if flag.enabled else 'disabled'}",
        event="enabled" if flag.enabled else "disabled",
        field_changed="enabled",
        old_value=previous_enabled,
        new_value=flag.enabled,
    )
    return flag


@router.put("/{flag_id}/rollout", response_model=FlagDetail)
@router.patch("/{flag_id}/rollout", response_model=FlagDetail)
def update_flag_rollout(
    flag_id: int,
    data: RolloutUpdate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    previous_rollout = getattr(flag, "rollout_percentage", 100)
    flag.rollout_percentage = data.rollout_percentage
    database.commit()
    database.refresh(flag)
    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="rollout_changed",
        actor=_flag_actor(data, current_user),
        details=f"Rollout updated for flag {flag.key}",
        event="rollout_changed",
        field_changed="rollout_percentage",
        old_value=previous_rollout,
        new_value=flag.rollout_percentage,
    )
    return get_flag_details(flag_id, database, current_user)


# New rollout endpoints: statistics and users list
@router.get("/{flag_id}/rollout/statistics")
def get_rollout_statistics(
    flag_id: int,
    environment: str = "production",
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    selected_environment = (
        database.query(Environment)
        .filter(
            or_(
                Environment.owner_id == current_user.id,
                Environment.owner_id.is_(None),
            ),
            (Environment.key == environment) | (Environment.name == environment),
        )
        .first()
    )
    override = None
    if selected_environment is not None:
        override = (
            database.query(EnvironmentFlagOverride)
            .filter(
                EnvironmentFlagOverride.flag_id == flag_id,
                EnvironmentFlagOverride.environment_id == selected_environment.id,
            )
            .first()
        )
    rollout_percentage = (
        override.rollout_percentage
        if override and override.rollout_percentage is not None
        else getattr(flag, "rollout_percentage", 100)
    )

    service = EvaluationService(database)

    # If the flag has explicit target users configured, evaluate only those users.
    target_users = _flag_target_users_payload(database, flag.id)
    if target_users:
        total = len(target_users)
        enabled = 0
        for uid in target_users:
            try:
                result = service.evaluate(flag.key, environment, user_id=str(uid))
                if result.get("value"):
                    enabled += 1
            except Exception:
                # ignore per-user failures
                continue
    else:
        total = database.query(User).filter(User.is_active == True).count()
        enabled = 0
        batch_size = 1000
        offset = 0
        while True:
            rows = database.query(User.id).filter(User.is_active == True).offset(offset).limit(batch_size).all()
            if not rows:
                break
            for (uid,) in rows:
                try:
                    result = service.evaluate(flag.key, environment, user_id=str(uid))
                    if result.get("value"):
                        enabled += 1
                except Exception:
                    # ignore per-user failures
                    continue
            offset += batch_size

    disabled = max(total - enabled, 0)
    enabled_percent = round((enabled / total) * 100, 2) if total else 0.0
    disabled_percent = round(100.0 - enabled_percent, 2) if total else 0.0

    return {
        "flag_key": flag.key,
        "rollout_percentage": rollout_percentage,
        "total_users": total,
        "enabled_users": enabled,
        "disabled_users": disabled,
        "enabled_percent": enabled_percent,
        "disabled_percent": disabled_percent,
        "environment": environment,
    }


@router.get("/{flag_id}/rollout/users")
def get_rollout_users(
    flag_id: int,
    status: str | None = None,
    environment: str = "production",
    page: int | None = 1,
    page_size: int | None = 50,
    search: str | None = None,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    service = EvaluationService(database)

    matches: list[dict] = []

    # If target users are explicitly configured for the flag, evaluate only them.
    target_users = _flag_target_users_payload(database, flag.id)
    if target_users:
        iterable = [str(u) for u in target_users]
    else:
        # Fallback to evaluating all active users in the database
        iterable = []
        batch_size = 1000
        offset = 0
        while True:
            rows = database.query(User.id).filter(User.is_active == True).offset(offset).limit(batch_size).all()
            if not rows:
                break
            for (uid,) in rows:
                iterable.append(str(uid))
            offset += batch_size

    for uid_str in iterable:
        try:
            result = service.evaluate(flag.key, environment, user_id=uid_str)
        except Exception:
            continue
        is_enabled = bool(result.get("value"))
        if status == "enabled" and not is_enabled:
            continue
        if status == "disabled" and is_enabled:
            continue
        matches.append({
            "user_id": uid_str,
            "reason": result.get("reason"),
            "environment": environment,
        })

    # simple search filtering
    if search:
        matches = [m for m in matches if search.lower() in (m["user_id"] or "").lower() or search.lower() in (m["reason"] or "").lower()]

    total_matches = len(matches)
    page = max(1, int(page or 1))
    page_size = max(1, min(1000, int(page_size or 50)))
    start = (page - 1) * page_size
    end = start + page_size
    paged = matches[start:end]

    return {"total": total_matches, "page": page, "page_size": page_size, "users": paged}


# Bulk add target users
from pydantic import BaseModel


class BulkUserAdd(BaseModel):
    user_ids: list[str]


@router.post("/{flag_id}/target-users/bulk", status_code=201)
def bulk_add_flag_target_users(
    flag_id: int,
    payload: BulkUserAdd,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    added = []
    skipped = []
    for uid in payload.user_ids:
        normalized = (uid or "").strip()
        if not normalized:
            continue
        created = None
        try:
            created = target_user_crud.create_target_user(database, flag_id, normalized)
        except Exception:
            created = None
        if created is None:
            skipped.append(normalized)
        else:
            added.append(normalized)

    _invalidate_flag_cache(flag.key)
    return {"added": added, "skipped": skipped}


@router.get("/{flag_id}/target-users", response_model=list[str])
def list_flag_target_users(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return _flag_target_users_payload(database, flag_id)


@router.post("/{flag_id}/target-users", status_code=status.HTTP_201_CREATED)
def add_flag_target_user(
    flag_id: int,
    data: TargetUserCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    user_id = data.user_id.strip()
    if not user_id:
        raise HTTPException(status_code=400, detail="User ID cannot be empty.")

    created = target_user_crud.create_target_user(database, flag_id, user_id)
    if created is None:
        raise HTTPException(status_code=409, detail="Target user already exists.")

    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="target_user_added",
        actor=_flag_actor(data, current_user),
        details=f"Added target user {user_id} to flag {flag.key}",
        event="target_user_added",
        field_changed="target_user",
        old_value=None,
        new_value=user_id,
    )
    return {"user_id": user_id}


@router.delete("/{flag_id}/target-users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_flag_target_user(
    flag_id: int,
    user_id: str,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    deleted = target_user_crud.delete_target_user(database, flag_id, user_id.strip())
    if deleted is None:
        raise HTTPException(status_code=404, detail="Target user not found.")

    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="target_user_removed",
        actor=getattr(current_user, "email", None) or "system",
        details=f"Removed target user {user_id} from flag {flag.key}",
        event="target_user_removed",
        field_changed="target_user",
        old_value=user_id,
        new_value=None,
    )
    return None


@router.get("/{flag_id}/target-groups", response_model=list[str])
def list_flag_target_groups(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return _flag_target_groups_payload(database, flag_id)


@router.post("/{flag_id}/target-groups", status_code=status.HTTP_201_CREATED)
def add_flag_target_group(
    flag_id: int,
    data: FlagTargetGroupCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    group_name = data.group_name.strip()
    if not group_name:
        raise HTTPException(status_code=400, detail="Group name cannot be empty.")

    if get_group_by_name(database, group_name) is None:
        raise HTTPException(status_code=400, detail="Invalid group name.")

    created = target_group_crud.create_target_group(database, flag_id, group_name)
    if created is None:
        raise HTTPException(status_code=409, detail="Target group already exists.")

    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="target_group_added",
        actor=_flag_actor(data, current_user),
        details=f"Added target group {group_name} to flag {flag.key}",
        event="target_group_added",
        field_changed="target_group",
        old_value=None,
        new_value=group_name,
    )
    return {"group_name": group_name}


@router.delete("/{flag_id}/target-groups/{group_name}", status_code=status.HTTP_204_NO_CONTENT)
def remove_flag_target_group(
    flag_id: int,
    group_name: str,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    deleted = target_group_crud.delete_target_group(database, flag_id, group_name.strip())
    if deleted is None:
        raise HTTPException(status_code=404, detail="Target group not found.")

    _invalidate_flag_cache(flag.key)
    _log_flag_event(
        database,
        flag,
        action="target_group_removed",
        actor=getattr(current_user, "email", None) or "system",
        details=f"Removed target group {group_name} from flag {flag.key}",
        event="target_group_removed",
        field_changed="target_group",
        old_value=group_name,
        new_value=None,
    )
    return None


@router.get("/{flag_id}/environments", response_model=list[dict])
def list_flag_environment_overrides(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    rows = (
        database.query(EnvironmentFlagOverride, Environment)
        .join(Environment, Environment.id == EnvironmentFlagOverride.environment_id)
        .filter(EnvironmentFlagOverride.flag_id == flag_id)
        .all()
    )
    return [
        {
            "flag_id": flag_id,
            "environment_id": environment.id,
            "environment": environment.key or environment.name,
            "enabled": bool(getattr(override, "enabled", getattr(override, "value", True))),
            "value": bool(getattr(override, "value", getattr(override, "enabled", True))),
            "rollout_percentage": getattr(override, "rollout_percentage", None),
        }
        for override, environment in rows
    ]


@router.get("/{flag_id}/environments/{environment_id}", response_model=dict)
def get_flag_environment_override(
    flag_id: int,
    environment_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    override = (
        database.query(EnvironmentFlagOverride)
        .filter(
            EnvironmentFlagOverride.flag_id == flag_id,
            EnvironmentFlagOverride.environment_id == environment_id,
        )
        .first()
    )
    if override is None:
        raise HTTPException(status_code=404, detail="Environment override not found")
    return {
        "flag_id": flag_id,
        "environment_id": environment_id,
        "enabled": bool(getattr(override, "enabled", getattr(override, "value", True))),
        "value": bool(getattr(override, "value", getattr(override, "enabled", True))),
        "rollout_percentage": getattr(override, "rollout_percentage", None),
    }


@router.put("/{flag_id}/environments/{environment_id}", response_model=dict)
def update_flag_environment_override(
    flag_id: int,
    environment_id: int,
    data: FlagEnvironmentOverrideInput,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    environment = database.query(Environment).filter(Environment.id == environment_id).first()
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")

    override = (
        database.query(EnvironmentFlagOverride)
        .filter(
            EnvironmentFlagOverride.flag_id == flag_id,
            EnvironmentFlagOverride.environment_id == environment_id,
        )
        .first()
    )
    if override is None:
        override = EnvironmentFlagOverride(flag_id=flag_id, environment_id=environment_id, value=True, enabled=True)
        database.add(override)

    resolved_enabled = data.enabled if data.enabled is not None else data.value if data.value is not None else getattr(override, "enabled", getattr(override, "value", True))
    override.enabled = bool(resolved_enabled)
    override.value = bool(resolved_enabled)
    if data.rollout_percentage is not None:
        override.rollout_percentage = data.rollout_percentage
    database.commit()
    database.refresh(override)
    _invalidate_flag_cache(flag.key)
    return {
        "flag_id": flag_id,
        "environment_id": environment_id,
        "environment": environment.key or environment.name,
        "enabled": bool(getattr(override, "enabled", getattr(override, "value", True))),
        "value": bool(getattr(override, "value", getattr(override, "enabled", True))),
        "rollout_percentage": getattr(override, "rollout_percentage", None),
        "message": "Environment override updated successfully",
    }


@router.post("/{flag_id}/rollback/{version_number}", response_model=FlagDetail)
def rollback_flag(
    flag_id: int,
    version_number: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    _log_flag_event(
        database,
        flag,
        action="rolled_back",
        actor=getattr(current_user, "email", None) or "system",
        details=f"Rollback requested for flag {flag.key} to version {version_number}",
        event="rolled_back",
    )
    return get_flag_details(flag_id, database, current_user)


@router.delete("/{flag_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flag(
    flag_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = flag_crud.get_flag_by_id(database, flag_id, owner_id=current_user.id)
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    flag_key = flag.key
    _log_flag_event(
        database,
        flag,
        action="deleted",
        actor=getattr(current_user, "email", None) or "system",
        details=f"Deleted flag {flag.key}",
        event="deleted",
        snapshot=False,
    )

    # Several legacy child tables do not declare database-level cascades.
    # Remove those rows explicitly before deleting the parent flag.
    for model in (
        CleanupCandidate,
        EvaluationMetric,
        EnvironmentFlagOverride,
        FlagHistory,
        FlagTargetGroup,
        FlagTargetUser,
        FlagVersion,
        TargetingRule,
    ):
        database.query(model).filter(model.flag_id == flag_id).delete(
            synchronize_session=False
        )

    deleted_flag = flag_crud.delete_flag(
        database, flag_id, owner_id=current_user.id
    )
    if deleted_flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    _invalidate_flag_cache(flag_key)
