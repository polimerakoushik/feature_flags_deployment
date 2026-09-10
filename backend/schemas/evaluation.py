from typing import Any

from pydantic import BaseModel, Field


class EvaluateFlagRequest(BaseModel):
    flag_key: str = Field(min_length=1)
    environment: str = Field(min_length=1)
    user_id: str | None = None
    groups: list[str] = Field(default_factory=list)
    user_context: dict[str, Any] = Field(default_factory=dict)


class EvaluateFlagResponse(BaseModel):
    flag_key: str
    environment: str
    value: Any
    reason: str
    user_id: str | None = None
    group_matches: list[str] = Field(default_factory=list)
    bucket: float | None = None
    rollout_percentage: int | None = None
    cached: bool = False


class EvaluateValueResponse(BaseModel):
    value: bool
