"""Feature-flag evaluation logic."""

import hashlib

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.crud.flag_target_groups import user_in_target_group
from backend.crud.flag_target_users import get_target_users_by_flag_id
from backend.models.environment import Environment
from backend.models.environment_flag_override import EnvironmentFlagOverride
from backend.models.flag import Flag


def _rollout_bucket(flag_key: str, user_id: str) -> int:
    """Return a stable 0-99 bucket for a user within a specific flag."""
    digest = hashlib.sha256(f"{flag_key}:{user_id}".encode("utf-8")).hexdigest()
    return int(digest[:8], 16) % 100


def evaluate_flag(
    database: Session,
    flag_key: str,
    environment: str,
    user_context: dict | None = None,
    owner_user_id: int | None = None,
) -> bool:
    """Return the Boolean result for one flag in an environment.

    Evaluation order:
    1. Targeted user_id returns True immediately.
    2. Targeted user group returns True immediately.
    3. Disabled or unknown flags return False.
    4. Environment override takes priority.
    5. Rollout percentage applies deterministically by user for boolean flags.
    6. Fallback to default value.
    """
    context = user_context or {}

    flag_query = database.query(Flag).filter(Flag.key == flag_key)
    if owner_user_id is not None:
        flag_query = flag_query.filter(Flag.owner_id == owner_user_id)
    flag = flag_query.first()
    if flag is None:
        return False

    user_id = None
    if isinstance(context, dict):
        user_id = context.get("user_id") or context.get("userId")

    if user_id:
        normalized_user_id = str(user_id)
        target_rows = get_target_users_by_flag_id(database, flag.id)
        if any(getattr(row, "user_id", None) == normalized_user_id for row in target_rows):
            return True
        if user_in_target_group(database, flag.id, normalized_user_id):
            return True

    if flag.enabled is not True:
        return False

    environment_query = database.query(Environment).filter(
        func.lower(Environment.name) == environment.strip().lower()
    )
    if owner_user_id is not None:
        environment_query = environment_query.filter(Environment.owner_id == owner_user_id)
    selected_environment = environment_query.first()
    if selected_environment is None:
        return False

    override = (
        database.query(EnvironmentFlagOverride)
        .filter(
            EnvironmentFlagOverride.flag_id == flag.id,
            EnvironmentFlagOverride.environment_id == selected_environment.id,
        )
        .first()
    )
    if override is not None:
        return override.value

    rollout_percentage = getattr(flag, "rollout_percentage", 100)
    try:
        rollout_percentage = int(rollout_percentage)
    except (TypeError, ValueError):
        rollout_percentage = 100
    rollout_percentage = max(0, min(100, rollout_percentage))

    if flag.type == "boolean" and rollout_percentage < 100:
        if not user_id:
            return False
        return _rollout_bucket(flag.key, str(user_id)) < rollout_percentage

    return bool(flag.default_value)
