from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func

from backend.database import Base


class FlagTargetUser(Base):
    __tablename__ = "flag_target_users"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False, index=True)
    user_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
