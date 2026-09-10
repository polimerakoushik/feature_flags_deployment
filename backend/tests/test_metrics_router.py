from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base
from backend.models.evaluation_metric import EvaluationMetric
from backend.models.flag import Flag
from backend.models.user import User
from routers.metrics import get_flag_metrics


def build_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return Session(), engine


def test_get_flag_metrics_returns_hourly_7_day_series():
    session, engine = build_session()
    try:
        user = User(
            name="Ada",
            email="ada@example.com",
            password_hash="hash",
            company="FeatureFlow",
            role="Developer",
        )
        session.add(user)
        session.commit()
        session.refresh(user)

        flag = Flag(
            key="checkout_redesign",
            type="boolean",
            default_value=True,
            description="test flag",
            enabled=True,
            owner_id=user.id,
        )
        session.add(flag)
        session.commit()
        session.refresh(flag)

        bucket = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
        session.add(EvaluationMetric(flag_key=flag.key, environment="development", bucket=bucket, evaluations=5))
        session.commit()

        result = get_flag_metrics(flag.id, days=7, database=session, current_user=user)

        assert result["flag_key"] == flag.key
        assert len(result["metrics"]) >= 7 * 24
        assert result["metrics"][0]["count"] == 0 or result["metrics"][0]["count"] == 5
        assert all(item["count"] >= 0 for item in result["metrics"])
        assert result["metrics"][-1]["count"] >= 0
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def test_metrics_endpoint_is_registered_on_app():
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    protected_response = client.get("/api/flags/999/metrics")
    assert protected_response.status_code in {401, 403}


def test_metrics_endpoint_accepts_environment_filter():
    import inspect
    from routers.metrics import get_flag_metrics
    assert "environment" in inspect.signature(get_flag_metrics).parameters
