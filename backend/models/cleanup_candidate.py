from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.sql import func

from backend.database import Base


class CleanupCandidate(Base):
    __tablename__ = "cleanup_candidates"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False, index=True)
    candidate_type = Column(String, nullable=False)  # 'fully_rolled_out' | 'fully_disabled'
    eligible_since = Column(DateTime(timezone=True), nullable=False)
    reviewed = Column(Boolean, nullable=False, default=False)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    review_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
