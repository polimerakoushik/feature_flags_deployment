import json
from typing import Any

try:
    import redis
except ImportError:  # pragma: no cover - optional dependency
    redis = None

from backend.config import settings


class MemoryCache:
    def __init__(self):
        self._store: dict[str, Any] = {}
        # in-memory analytics counter: key -> int
        self._analytics: dict[str, int] = {}

    def get(self, key: str):
        return self._store.get(key)

    def set(self, key: str, value: Any, ttl: int | None = None):
        self._store[key] = value

    def delete(self, key: str):
        self._store.pop(key, None)

    def delete_prefix(self, prefix: str):
        for key in list(self._store.keys()):
            if key.startswith(prefix):
                del self._store[key]

    def incr(self, key: str, amount: int = 1):
        self._analytics[key] = self._analytics.get(key, 0) + amount
        return self._analytics[key]

    def get_analytics(self, key: str):
        return self._analytics.get(key)

    def analytics_snapshot(self, pattern: str = "analytics:flag:*"):
        prefix = pattern[:-1] if pattern.endswith("*") else pattern
        return {key: value for key, value in self._analytics.items() if key.startswith(prefix)}

    def delete_analytics_keys(self, keys):
        for key in keys:
            self._analytics.pop(key, None)

    def pop_analytics_keys(self, pattern: str = "analytics:flag:*"):
        data = self.analytics_snapshot(pattern)
        self.delete_analytics_keys(data.keys())
        return data

    def health(self) -> str:
        return "optional/unavailable"


class RedisCache:
    def __init__(self):
        if redis is None:
            raise RuntimeError("redis package is not installed")
        self.client = redis.Redis.from_url(settings.resolved_redis_url, decode_responses=True)

    def get(self, key: str):
        value = self.client.get(key)
        if value is None:
            return None
        return json.loads(value)

    def set(self, key: str, value: Any, ttl: int | None = None):
        payload = json.dumps(value)
        if ttl is None:
            self.client.set(key, payload)
        else:
            self.client.setex(key, ttl, payload)

    def delete(self, key: str):
        self.client.delete(key)

    def delete_prefix(self, prefix: str):
        keys = list(self.client.scan_iter(match=f"{prefix}*"))
        if keys:
            self.client.delete(*keys)

    def incr(self, key: str, amount: int = 1):
        return self.client.incrby(key, amount)

    def get_analytics(self, key: str):
        value = self.client.get(key)
        if value is None:
            return None
        try:
            return int(value)
        except Exception:
            return None

    def analytics_snapshot(self, pattern: str = "analytics:flag:*"):
        result = {}
        for key in self.client.scan_iter(match=pattern):
            value = self.client.get(key)
            try:
                result[key] = int(value or 0)
            except Exception:
                result[key] = 0
        return result

    def delete_analytics_keys(self, keys):
        keys = list(keys)
        if keys:
            self.client.delete(*keys)

    def pop_analytics_keys(self, pattern: str = "analytics:flag:*"):
        result = self.analytics_snapshot(pattern)
        self.delete_analytics_keys(result.keys())
        return result

    def health(self) -> str:
        try:
            self.client.ping()
            return "connected"
        except Exception:
            return "optional/unavailable"


class CacheService:
    def __init__(self):
        self.backend = "memory"
        self._client = MemoryCache()
        if redis is not None:
            try:
                redis_client = RedisCache()
                if redis_client.health() == "connected":
                    self._client = redis_client
                    self.backend = "redis"
            except Exception:
                self._client = MemoryCache()
                self.backend = "memory"

    def get(self, key: str):
        return self._client.get(key)

    def set(self, key: str, value: Any, ttl: int = 60):
        self._client.set(key, value, ttl)

    def delete(self, key: str):
        self._client.delete(key)

    def delete_prefix(self, prefix: str):
        self._client.delete_prefix(prefix)

    def invalidate_flag(self, flag_key: str):
        self.delete_prefix(f"evaluation:{flag_key}:")

    def make_evaluation_key(
        self,
        flag_key: str,
        environment: str,
        user_id: str | None,
        groups: list[str] | None = None,
        flag_context: str | None = None,
    ) -> str:
        base_groups = ",".join(sorted(groups or []))
        user_value = user_id or "anonymous"
        context = flag_context or "default"
        return f"evaluation:{flag_key}:{environment}:{user_value}:{base_groups}:{context}"

    def record_evaluation(self, flag_key: str, environment: str, hour_bucket: str | None = None):
        """Record a single evaluation counter for the given flag_key and environment.

        hour_bucket: optional YYYYmmddHH string. If None, computed from UTC now.
        """
        from datetime import datetime
        from zoneinfo import ZoneInfo
        from backend.config import settings

        if hour_bucket is None:
            hour_bucket = datetime.now(
                ZoneInfo(settings.analytics_timezone)
            ).strftime('%Y%m%d%H')
        key = f"analytics:flag:{flag_key}:{environment}:{hour_bucket}"
        # increment underlying client if available
        if hasattr(self._client, "incr"):
            return self._client.incr(key, 1)
        # fallback: use set/get
        val = self._client.get_analytics(key) if hasattr(self._client, "get_analytics") else None
        if val is None:
            self._client.incr(key, 1)
            return 1
        else:
            self._client.incr(key, 1)
            return val + 1

    def analytics_snapshot(self, pattern: str = "analytics:flag:*"):
        if hasattr(self._client, "analytics_snapshot"):
            return self._client.analytics_snapshot(pattern)
        return {}

    def delete_analytics_keys(self, keys):
        if hasattr(self._client, "delete_analytics_keys"):
            self._client.delete_analytics_keys(keys)

    def pop_analytics(self, pattern: str = "analytics:flag:*"):
        """Backward-compatible destructive read. Prefer snapshot + delete after DB commit."""
        if hasattr(self._client, "pop_analytics_keys"):
            return self._client.pop_analytics_keys(pattern)
        return {}

    def health(self) -> str:
        return self._client.health()


cache_service = CacheService()
