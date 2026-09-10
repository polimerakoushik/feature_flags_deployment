from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import synonym

from backend.database import Base


class Flag(Base):
    __tablename__ = "flags"
    __table_args__ = (
        UniqueConstraint("owner_id", "key", name="uq_flags_owner_key_current"),
        Index("ix_flags_environment", "environment"),
        Index("ix_flags_environment_key", "environment", "key"),
    )

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, nullable=False, index=True)
    name = Column(String, nullable=True)
    type = Column(String, nullable=False, default="boolean")
    default_value = Column(JSON, nullable=False, default=True)
    description = Column(Text, nullable=True)
    owner_team = Column(String, nullable=True)
    environment = Column(String, nullable=False, default="development")
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="SET NULL"), nullable=True, index=True)
    rollout_percentage = Column(Integer, nullable=False, default=100)
    enabled = Column(Boolean, nullable=False, default=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    owner_user_id = synonym("owner_id")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
