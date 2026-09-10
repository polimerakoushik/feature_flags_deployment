from datetime import datetime

from pydantic import BaseModel


class FlagVersionBase(BaseModel):
    flag_id: int
    version: int
    changes_summary: str | None = None
    snapshot: dict | None = None
    created_by: str | None = None


class FlagVersionCreate(FlagVersionBase):
    pass


class FlagVersion(FlagVersionBase):
    id: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class RollbackRequest(BaseModel):
    actor: str | None = None
