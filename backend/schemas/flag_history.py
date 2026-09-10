from datetime import datetime

from pydantic import BaseModel


class FlagHistoryEntry(BaseModel):
    id: int
    flag_id: int
    event: str
    summary: str | None = None
    actor: str | None = None
    environment: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True
