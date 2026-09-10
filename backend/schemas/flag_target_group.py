from datetime import datetime

from pydantic import BaseModel


class FlagTargetGroupBase(BaseModel):
    group_name: str


class FlagTargetGroupCreate(FlagTargetGroupBase):
    pass


class FlagTargetGroup(FlagTargetGroupBase):
    id: int
    flag_id: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True
