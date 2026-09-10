from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.schemas.audit_log import AuditLog
from backend.schemas.flag_history import FlagHistoryEntry
from backend.schemas.flag_version import FlagVersion


class FlagBase(BaseModel):
    key: str
    name: str | None = None
    type: Literal["boolean", "string", "number"] = "boolean"
    default_value: bool | str | float = True
    description: str | None = None
    owner_team: str | None = None
    enabled: bool = True
    environment: str | None = "development"
    environment_id: int | None = None
    rollout_percentage: int = Field(default=100, ge=0, le=100)
    tags: list[str] = Field(default_factory=list)
    dependencies: list[str] = Field(default_factory=list)
    linked_experiments: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_default_value(self):
        if self.type == "boolean" and not isinstance(self.default_value, bool):
            raise ValueError("Boolean flags require a true or false default_value")
        if self.type == "string" and not isinstance(self.default_value, str):
            raise ValueError("String flags require a string default_value")
        if self.type == "number" and (isinstance(self.default_value, bool) or not isinstance(self.default_value, (int, float))):
            raise ValueError("Number flags require a numeric default_value")
        return self


class FlagCreate(FlagBase):
    actor: str | None = Field(default=None, exclude=True)


class FlagUpdate(FlagBase):
    actor: str | None = Field(default=None, exclude=True)


class Flag(FlagBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_by: str | None = None
    updated_by: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

class StatusUpdate(BaseModel):
    enabled: bool
    actor: str | None = None


class RolloutUpdate(BaseModel):
    rollout_percentage: int = Field(ge=0, le=100)
    actor: str | None = None


class EnvironmentConfig(BaseModel):
    environment: str
    value: Any = None
    enabled: bool | None = None
    rollout_percentage: int | None = None
    is_override: bool = False


class FlagDetail(Flag):
    """Aggregated payload for the Flag Details page: one round trip instead of five."""

    versions: list[FlagVersion] = Field(default_factory=list)
    audit_logs: list[AuditLog] = Field(default_factory=list)
    history: list[FlagHistoryEntry] = Field(default_factory=list)
    target_users: list[str] = Field(default_factory=list)
    target_groups: list[str] = Field(default_factory=list)
    total_users: int = 0
    included_users: int = 0
    excluded_users: int = 0
    environment_configs: list[EnvironmentConfig] = Field(default_factory=list)


