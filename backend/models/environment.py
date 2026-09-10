from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import synonym

from backend.database import Base


class Environment(Base):
    __tablename__ = "environments"
    __table_args__ = (UniqueConstraint("owner_id", "key", name="uq_environments_owner_key_current"),)

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    key = Column(String, nullable=False, index=True, default="development")
    description = Column(String, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    owner_user_id = synonym("owner_id")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


