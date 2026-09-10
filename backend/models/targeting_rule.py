from sqlalchemy import Boolean, Column, ForeignKey, Integer, String

from backend.database import Base


class TargetingRule(Base):
    __tablename__ = "targeting_rules"

    id = Column(Integer, primary_key=True, index=True)
    flag_id = Column(Integer, ForeignKey("flags.id"), nullable=False)
    attribute = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    value = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
