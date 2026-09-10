from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint

from backend.database import Base


class EnvironmentFlagOverride(Base):
    """An override for a flag in a given environment."""

    __tablename__ = "environment_flag_overrides"
    __table_args__ = (
        UniqueConstraint("flag_id", "environment_id", name="uq_flag_environment_override"),
    )

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id", ondelete="CASCADE"), nullable=False, index=True)
    environment_id = Column(Integer, ForeignKey("environments.id", ondelete="CASCADE"), nullable=False, index=True)
    value = Column(Boolean, nullable=True)
    enabled = Column(Boolean, nullable=True)
    rollout_percentage = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
