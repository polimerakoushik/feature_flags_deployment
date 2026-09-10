from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogBase(BaseModel):
    action: str
    entity_type: str
    entity_id: int
    entity_name: str | None = None
    actor: str | None = None
    environment: str | None = None
    field_changed: str | None = None
    old_value: str | None = None
    new_value: str | None = None
    details: str | None = None


class AuditLogCreate(AuditLogBase):
    pass


class AuditLog(AuditLogBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class AuditLogPage(BaseModel):
    """Paginated audit log response so the UI can render page controls."""

    items: list[AuditLog]
    total: int
    page: int
    page_size: int
