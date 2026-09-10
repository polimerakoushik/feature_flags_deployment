import json
from typing import Any

from backend.models.audit_log import AuditLog
from backend.models.flag_history import FlagHistory


def stringify(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    return json.dumps(value, default=str)


def flag_snapshot(flag) -> dict:
    return {
        "id": flag.id,
        "key": flag.key,
        "name": getattr(flag, "name", None),
        "type": flag.type,
        "default_value": flag.default_value,
        "description": flag.description,
        "owner_team": flag.owner_team,
        "enabled": flag.enabled,
        "environment": flag.environment,
        "rollout_percentage": getattr(flag, "rollout_percentage", 100),
    }


def diff_fields(before: dict, after: dict):
    changes = []
    for key in sorted(set(before) | set(after)):
        if before.get(key) != after.get(key):
            changes.append((key, before.get(key), after.get(key)))
    return changes


def record_event(
    database,
    flag,
    *,
    event: str,
    action: str,
    actor: str | None = None,
    details: str | None = None,
    snapshot: bool = False,
    changes_summary: str | None = None,
    field_changed: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
):
    owner_user_id = getattr(flag, "owner_user_id", getattr(flag, "owner_id", None))
    database.add(
        AuditLog(
            owner_user_id=owner_user_id,
            action=action,
            entity_type="flag",
            entity_id=flag.id,
            entity_name=getattr(flag, "name", None) or getattr(flag, "key", None),
            actor=actor or "system",
            environment=flag.environment,
            field_changed=field_changed,
            old_value=stringify(old_value),
            new_value=stringify(new_value),
            details=details,
        )
    )

    if snapshot:
        database.add(
            FlagHistory(
                flag_id=flag.id,
                event=event,
                summary=changes_summary or details or event,
                actor=actor or "system",
                environment=flag.environment,
            )
        )

    database.commit()
    return True
