import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database import Base, get_db
from backend.models.environment import Environment
from backend.models.environment_flag_override import EnvironmentFlagOverride
from backend.models.flag import Flag
from backend.models.evaluation_metric import EvaluationMetric
from routers.evaluation import router as evaluation_router
from backend.services.auth import get_current_user


class FakeUser:
    id = 1
    email = "qa@featureflow.local"


@pytest.fixture()
def client():
    """A router test client backed by a clean in-memory database."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(engine)

    application = FastAPI()
    application.include_router(evaluation_router)

    def override_get_db():
        database = testing_session()
        try:
            yield database
        finally:
            database.close()

    application.dependency_overrides[get_db] = override_get_db
    application.dependency_overrides[get_current_user] = lambda: FakeUser()

    with TestClient(application) as test_client:
        yield test_client, testing_session

    Base.metadata.drop_all(engine)


def add_flag(database, *, enabled=True, default_value=True):
    environment = Environment(name="Development", description="Test environment", owner_user_id=1)
    flag = Flag(
        owner_user_id=1,
        key="dark_mode",
        type="boolean",
        default_value=default_value,
        owner_team="Frontend Team",
        environment="developing",
        enabled=enabled,
    )
    database.add_all([environment, flag])
    database.commit()
    database.refresh(environment)
    database.refresh(flag)
    return flag, environment


def test_evaluate_returns_default_value_when_no_override_exists(client):
    test_client, session_factory = client
    database = session_factory()
    add_flag(database, default_value=True)
    database.close()

    response = test_client.get(
        "/evaluate",
        params={"flag_key": "dark_mode", "environment": "Development"},
    )

    assert response.status_code == 200
    assert response.json() == {"value": True}


def test_evaluate_persists_metric_for_future_sessions(client):
    test_client, session_factory = client
    database = session_factory()
    flag, _ = add_flag(database)
    database.close()

    response = test_client.get(
        "/evaluate",
        params={"flag_key": flag.key, "environment": "Development"},
    )

    assert response.status_code == 200
    with session_factory() as database:
        metric = (
            database.query(EvaluationMetric)
            .filter(
                EvaluationMetric.flag_id == flag.id,
                EvaluationMetric.environment == "Development",
            )
            .one()
        )
        assert metric.evaluations == 1


def test_evaluate_uses_environment_override(client):
    test_client, session_factory = client
    database = session_factory()
    flag, environment = add_flag(database, default_value=True)
    database.add(EnvironmentFlagOverride(flag_id=flag.id, environment_id=environment.id, value=False))
    database.commit()
    database.close()

    response = test_client.get(
        "/evaluate",
        params={"flag_key": "dark_mode", "environment": "Development"},
    )

    assert response.status_code == 200
    assert response.json() == {"value": False}


def test_disabled_flag_always_returns_false_even_with_override(client):
    test_client, session_factory = client
    database = session_factory()
    flag, environment = add_flag(database, enabled=False, default_value=True)
    database.add(EnvironmentFlagOverride(flag_id=flag.id, environment_id=environment.id, value=True))
    database.commit()
    database.close()

    response = test_client.get(
        "/evaluate",
        params={"flag_key": "dark_mode", "environment": "Development"},
    )

    assert response.status_code == 200
    assert response.json() == {"value": False}


def test_evaluate_accepts_empty_or_missing_user_context(client):
    test_client, session_factory = client
    database = session_factory()
    add_flag(database, default_value=True)
    database.close()

    missing_context = test_client.post(
        "/evaluate",
        json={"flag_key": "dark_mode", "environment": "Development"},
    )
    empty_context = test_client.post(
        "/evaluate",
        json={"flag_key": "dark_mode", "environment": "Development", "user_context": {}},
    )

    assert missing_context.status_code == 200
    assert missing_context.json() == {"value": True}
    assert empty_context.status_code == 200
    assert empty_context.json() == {"value": True}
