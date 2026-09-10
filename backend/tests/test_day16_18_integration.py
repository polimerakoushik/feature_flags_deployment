from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend.models import Environment, Flag, User
from backend.routers.metrics import get_flag_metrics
from backend.services.auth import verify_access_token
from backend.services.cache import MemoryCache, cache_service
from backend.utils.flag_middleware import FlagCacheClient
from backend.utils.security import create_access_token
from backend.services.evaluation_service import EvaluationService
from backend.crud.cleanup import scan_cleanup_candidates, list_cleanup_candidates


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)(), engine


def test_login_token_is_accepted_by_services_auth():
    token = create_access_token(123)
    assert verify_access_token(token) == 123


def test_live_evaluation_counter_is_visible_before_daily_flush():
    database, engine = _session()
    original_client, original_backend = cache_service._client, cache_service.backend
    try:
        cache_service._client = MemoryCache()
        cache_service.backend = "memory"
        user = User(name="Metrics", email="metrics@example.com", password_hash="x", is_active=True)
        database.add(user)
        database.commit()
        database.refresh(user)
        flag = Flag(key="live_metrics", type="boolean", default_value=True, enabled=True, owner_id=user.id)
        database.add(flag)
        database.commit()
        database.refresh(flag)

        cache_service.record_evaluation(flag.key, "production")
        result = get_flag_metrics(flag.id, days=7, environment="production", database=database, current_user=user)
        assert sum(point["count"] for point in result["metrics"]) == 1
    finally:
        cache_service._client, cache_service.backend = original_client, original_backend
        database.close()
        Base.metadata.drop_all(engine)


def test_cleanup_list_only_exposes_candidates_older_than_threshold():
    database, engine = _session()
    try:
        user = User(name="Cleanup", email="cleanup@example.com", password_hash="x", is_active=True)
        database.add(user)
        database.commit()
        database.refresh(user)
        for key, name in [("development", "Development"), ("staging", "Staging"), ("production", "Production")]:
            database.add(Environment(name=name, key=key, is_active=True, owner_id=user.id))
        database.commit()
        flag = Flag(key="old_flag", type="boolean", default_value=True, enabled=True, rollout_percentage=100, owner_id=user.id)
        database.add(flag)
        database.commit()
        database.refresh(flag)

        # New candidate is persisted for timer tracking but must not be returned yet.
        scan_cleanup_candidates(database, owner_user_id=user.id)
        total, _ = list_cleanup_candidates(database, owner_user_id=user.id, reviewed=False)
        assert total == 0

        flag.updated_at = datetime.utcnow() - timedelta(days=45)
        database.add(flag)
        database.commit()
        # Changing candidate type/state would reset it; simulate first discovery from the old state.
        from backend.models import CleanupCandidate
        database.query(CleanupCandidate).delete()
        database.commit()
        scan_cleanup_candidates(database, owner_user_id=user.id)
        total, items = list_cleanup_candidates(database, owner_user_id=user.id, reviewed=False)
        assert total == 1
        assert items[0].flag_id == flag.id
    finally:
        database.close()
        Base.metadata.drop_all(engine)


def test_middleware_percentage_bucket_matches_server_engine():
    client = FlagCacheClient(refresh_interval=5)
    try:
        client._flags = {
            "demo": {
                "key": "demo",
                "enabled": True,
                "default_value": True,
                "rollout_percentage": 37,
                "target_users": set(),
                "target_groups": set(),
            }
        }
        for user_id in ["a", "b", "user-123", "tester"]:
            expected = EvaluationService.rollout_bucket("demo", user_id) < 37
            assert client.evaluate("demo", user_id=user_id) is expected
    finally:
        client.stop()
