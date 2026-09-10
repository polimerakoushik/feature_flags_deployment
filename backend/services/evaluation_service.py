import hashlib
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.crud.flag_target_groups import user_in_target_group
from backend.crud.flag_target_users import get_target_users_by_flag_id
from backend.models.environment import Environment
from backend.models.environment_flag_override import EnvironmentFlagOverride
from backend.models.flag import Flag
from backend.models.flag_target_group import FlagTargetGroup


class EvaluationService:
    def __init__(self, database: Session):
        self.database = database

    @staticmethod
    def normalize_user_id(user_id: Any) -> str | None:
        if user_id is None:
            return None
        value = str(user_id).strip()
        return value or None

    @staticmethod
    def normalize_groups(groups: Any) -> list[str]:
        if not groups:
            return []
        if isinstance(groups, str):
            groups = [groups]
        normalized = []
        for group in groups:
            item = str(group).strip()
            if item:
                normalized.append(item)
        return normalized

    @staticmethod
    def rollout_bucket(flag_key: str, user_id: str) -> float:
        digest = hashlib.sha256(f"{user_id}{flag_key}".encode("utf-8")).hexdigest()
        return (int(digest[:8], 16) % 10000) / 100.0

    @staticmethod
    def normalize_rollout_percentage(value: Any) -> int:
        try:
            as_int = int(value)
        except (TypeError, ValueError):
            return 100
        return max(0, min(100, as_int))

    def get_flag(self, flag_key: str, owner_user_id: int | None = None) -> Flag | None:
        query = self.database.query(Flag).filter(Flag.key == flag_key)
        if owner_user_id is not None:
            query = query.filter(Flag.owner_id == owner_user_id)
        return query.first()

    def find_environment(self, environment_name: str, owner_user_id: int | None = None) -> Environment | None:
        value = (environment_name or "").strip()
        if not value:
            return None
        query = self.database.query(Environment).filter(
            (func.lower(Environment.name) == value.lower()) | (func.lower(Environment.key) == value.lower())
        )
        if owner_user_id is not None:
            query = query.filter(Environment.owner_id == owner_user_id)
        return query.first()

    def evaluate_user_targeting(self, flag: Flag, user_id: str | None) -> bool:
        if not user_id:
            return False
        target_rows = get_target_users_by_flag_id(self.database, flag.id)
        return any(str(getattr(row, "user_id", "")) == user_id for row in target_rows)

    def evaluate_group_targeting(self, flag: Flag, user_id: str | None, groups: list[str]) -> bool:
        if not user_id and not groups:
            return False
        targeted_group_names = {str(name).strip() for name in getattr(flag, "target_groups", []) if str(name).strip()}
        if not targeted_group_names:
            from backend.models.flag_target_group import FlagTargetGroup
            targeted_group_names = {
                str(row.group_name).strip()
                for row in self.database.query(FlagTargetGroup).filter(FlagTargetGroup.flag_id == flag.id).all()
            }
        if groups:
            if targeted_group_names.intersection(set(groups)):
                return True
        if user_id:
            if user_in_target_group(self.database, flag.id, user_id):
                return True
        return False

    def evaluate_environment_override(self, flag: Flag, environment: Environment | None) -> EnvironmentFlagOverride | None:
        if environment is None:
            return None
        return (
            self.database.query(EnvironmentFlagOverride)
            .filter(
                EnvironmentFlagOverride.flag_id == flag.id,
                EnvironmentFlagOverride.environment_id == environment.id,
            )
            .first()
        )

    def evaluate(self, flag_key: str, environment: str, user_id: str | None = None, groups: list[str] | None = None, user_context: dict | None = None, owner_user_id: int | None = None) -> dict:
        context = user_context or {}
        if user_id is None:
            user_id = self.normalize_user_id(context.get("user_id") or context.get("userId"))
        normalized_groups = self.normalize_groups(groups or context.get("groups") or [])
        flag = self.get_flag(flag_key, owner_user_id=owner_user_id)
        if flag is None:
            raise ValueError(f"Flag '{flag_key}' not found")

        normalized_user_id = self.normalize_user_id(user_id)
        reason = None
        value = bool(flag.default_value) if hasattr(flag, "default_value") else False
        bucket = None
        rollout_percentage = self.normalize_rollout_percentage(getattr(flag, "rollout_percentage", 100))

        if self.evaluate_user_targeting(flag, normalized_user_id):
            value = True
            reason = "user_targeting"
            return {
                "flag_key": flag.key,
                "value": value,
                "reason": reason,
                "environment": environment,
                "bucket": bucket,
                "rollout_percentage": rollout_percentage,
                "cached": False,
            }

        if self.evaluate_group_targeting(flag, normalized_user_id, normalized_groups):
            value = True
            reason = "group_targeting"
            return {
                "flag_key": flag.key,
                "value": value,
                "reason": reason,
                "environment": environment,
                "bucket": bucket,
                "rollout_percentage": rollout_percentage,
                "cached": False,
            }

        if flag.enabled is not True:
            return {
                "flag_key": flag.key,
                "value": False,
                "reason": "default",
                "environment": environment,
                "bucket": bucket,
                "rollout_percentage": rollout_percentage,
                "cached": False,
            }

        selected_environment = self.find_environment(environment, owner_user_id=owner_user_id)

        if normalized_user_id is not None:
            bucket = self.rollout_bucket(flag.key, normalized_user_id)
            if bucket < rollout_percentage:
                value = True
                reason = "percentage_rollout"
                return {
                    "flag_key": flag.key,
                    "value": value,
                    "reason": reason,
                    "environment": environment,
                    "bucket": round(bucket, 2),
                    "rollout_percentage": rollout_percentage,
                    "cached": False,
                }

        override = self.evaluate_environment_override(flag, selected_environment)
        if override is not None:
            override_value = getattr(override, "value", None)
            if override_value is None:
                override_value = getattr(override, "enabled", None)
            if override_value is not None:
                value = bool(override_value)
            if getattr(override, "rollout_percentage", None) is not None:
                bucket = bucket if bucket is not None else self.rollout_bucket(flag.key, normalized_user_id or f"{flag.key}:{environment}")
                rollout_override = self.normalize_rollout_percentage(getattr(override, "rollout_percentage"))
                value = bool(bucket < rollout_override)
            reason = "environment_override"
            return {
                "flag_key": flag.key,
                "value": value,
                "reason": reason,
                "environment": environment,
                "bucket": round(bucket, 2) if bucket is not None else None,
                "rollout_percentage": rollout_percentage,
                "cached": False,
            }

        default_value = flag.default_value
        if isinstance(default_value, bool):
            value = default_value
        else:
            value = bool(default_value)
        reason = "default"
        return {
            "flag_key": flag.key,
            "value": value,
            "reason": reason,
            "environment": environment,
            "bucket": round(bucket, 2) if bucket is not None else None,
            "rollout_percentage": rollout_percentage,
            "cached": False,
        }
