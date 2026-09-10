from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint, func
from backend.database import Base


class EvaluationMetric(Base):
    __tablename__ = "evaluation_metrics"
    __table_args__ = (
        UniqueConstraint("flag_id", "environment", "bucket", name="uq_flag_id_env_bucket"),
        Index("ix_evaluation_metrics_flag_environment", "flag_id", "environment"),
    )

    id = Column(Integer, primary_key=True, index=True)
    # Live analytics may be recorded before the corresponding flag row is
    # available; the flag key remains the stable lookup value.
    flag_id = Column(Integer, ForeignKey("flags.id", ondelete="CASCADE"), nullable=True, index=True)
    flag_key = Column(String, nullable=False, index=True)
    environment = Column(String, nullable=False, index=True)
    bucket = Column(DateTime(timezone=False), nullable=False, index=True)
    evaluations = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=False), server_default=func.now())
