from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func

from backend.database import Base


class FlagHistory(Base):
    """Per-flag lifecycle timeline (created, updated, enabled, rollout changed, ...).

    This powers the "Flag History" / "Rollout Timeline" sections on the Flag
    Details page. It is intentionally flag-scoped and lightweight; the
    cross-entity, filterable audit trail lives in ``AuditLog``. Both are
    written together by ``services.audit_service`` so they never drift.
    """

    __tablename__ = "flag_history"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False, index=True)
    event = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    actor = Column(String, nullable=True)
    environment = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
