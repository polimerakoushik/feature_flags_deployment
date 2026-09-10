"""
Lightweight Flag Cache / Middleware helper for consuming applications.

Usage:

from backend.utils.flag_middleware import FlagCacheClient

cache = FlagCacheClient(api_base_url=os.getenv("FEATURE_FLAG_API_URL", "http://localhost:8002/api"), refresh_interval=30, auth_token=None)
cache.start()

# get cached flag by key
flag = cache.get_flag("new-checkout")
# local evaluation
enabled = cache.evaluate("new-checkout", user_id="user-123", groups=["beta-users"], environment="production")

# stop background thread on shutdown
cache.stop()

Design goals:
- Keep a small in-memory cache of flags keyed by flag key.
- Periodically refresh from the API to minimize per-request network latency.
- Provide a deterministic local percentage-bucketing algorithm for quick evaluations (consistent hashing on user id).
- Honor explicit target_users and target_groups when available in cached flag metadata.

Notes:
- This helper is intentionally conservative and does not replace the authoritative evaluation logic on the server. Use it to reduce round-trips for low-latency checks; for security/authoritative decisions continue to consult the API or evaluation engine.
- Requires httpx (already in backend/requirements.txt).
"""

from __future__ import annotations

import hashlib
import os
import threading
import time
from typing import Dict, List, Optional, Any

import httpx


class FlagCacheClient:
    """A simple thread-based flag cache that fetches flag metadata from the API and allows local evaluation.

    It expects the API to provide an endpoint at {api_base_url}/flags returning a list of flag objects.
    Each flag object should include at least:
      - key (string)
      - rollout_percentage (number 0-100)
      - target_users (list of user ids) [optional]
      - target_groups (list of group names) [optional]

    Example cached shape by key:
      {
        "key": "new-checkout",
        "rollout_percentage": 50,
        "target_users": ["user-001", "user-002"],
        "target_groups": ["beta-users"]
      }
    """

    def __init__(
        self,
        api_base_url: str = os.getenv("FEATURE_FLAG_API_URL", "http://localhost:8002/api"),
        refresh_interval: int = 30,
        auth_token: Optional[str] = None,
        client_timeout: int = 10,
    ) -> None:
        self.api_base_url = api_base_url.rstrip("/")
        self.refresh_interval = max(5, int(refresh_interval))
        self.auth_token = auth_token
        self._flags: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._client = httpx.Client(timeout=client_timeout)

        if self.auth_token:
            self._client.headers.update({"Authorization": f"Bearer {self.auth_token}"})

    def start(self, background: bool = True) -> None:
        """Start the periodic refresh worker. If background is False, perform a single refresh synchronously."""
        if background:
            if self._thread and self._thread.is_alive():
                return
            self._stop_event.clear()
            self._thread = threading.Thread(target=self._refresh_loop, daemon=True)
            self._thread.start()
        else:
            self.refresh()

    def stop(self) -> None:
        """Stop the background refresh thread and close the httpx client."""
        self._stop_event.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        try:
            self._client.close()
        except Exception:
            pass

    def _refresh_loop(self) -> None:
        while not self._stop_event.is_set():
            try:
                self.refresh()
            except Exception:
                # swallow errors — caching should be best-effort
                pass
            # wait with early exit
            for _ in range(self.refresh_interval):
                if self._stop_event.is_set():
                    break
                time.sleep(1)

    def refresh(self) -> None:
        """Fetch latest flags from API and update the cache."""
        url = f"{self.api_base_url}/flags"
        r = self._client.get(url)
        r.raise_for_status()
        data = r.json()
        # Expect data to be a list of flags or an object with `flags` property
        flags_list = data if isinstance(data, list) else data.get("flags") if isinstance(data, dict) else None
        if flags_list is None:
            # Some backends return paged object with items property
            flags_list = data.get("items") if isinstance(data, dict) else []

        with self._lock:
            new_cache: Dict[str, Dict[str, Any]] = {}
            for f in flags_list:
                key = f.get("key") or f.get("name")
                if not key:
                    continue

                # The list endpoint intentionally stays compact. Fetch the details
                # payload when possible so local targeting matches the server.
                detailed = f
                flag_id = f.get("id")
                if flag_id is not None:
                    try:
                        detail_response = self._client.get(f"{self.api_base_url}/flags/{flag_id}/details")
                        if detail_response.is_success:
                            detailed = detail_response.json()
                    except Exception:
                        detailed = f

                rollout = detailed.get("rollout_percentage")
                try:
                    rollout = int(rollout) if rollout is not None else 0
                except Exception:
                    rollout = 0
                new_cache[key] = {
                    "key": key,
                    "enabled": bool(detailed.get("enabled", False)),
                    "default_value": detailed.get("default_value", False),
                    "environment": detailed.get("environment"),
                    "rollout_percentage": max(0, min(100, rollout)),
                    "target_users": set(detailed.get("target_users") or []),
                    "target_groups": set(detailed.get("target_groups") or []),
                    "raw": detailed,
                }
            self._flags = new_cache

    def get_flag(self, key: str) -> Optional[Dict[str, Any]]:
        """Return cached flag dict for a key, or None if not found."""
        with self._lock:
            return self._flags.get(key)

    @staticmethod
    def _hash_to_percent(flag_key: str, user_id: str) -> float:
        # Keep this identical to EvaluationService.rollout_bucket.
        digest = hashlib.sha256(f"{user_id}{flag_key}".encode("utf-8")).hexdigest()
        return (int(digest[:8], 16) % 10000) / 100.0

    def evaluate(
        self,
        key: str,
        user_id: Optional[str] = None,
        groups: Optional[List[str]] = None,
        environment: Optional[str] = None,
    ) -> bool:
        """Quick local evaluation using cached metadata.

        Rules (in order):
          1. If user_id is present and in target_users => enabled
          2. If groups intersects target_groups => enabled
          3. Otherwise use percentage rollout (hash user_id -> bucket). If user_id is None, evaluate as enabled only when rollout == 100.

        This mirrors typical simple percentage rollout behavior but is not a full replacement of server evaluation.
        """
        flag = self.get_flag(key)
        if not flag:
            # Unknown flag -> safe default: disabled
            return False

        if not flag.get("enabled", False):
            return False

        # 1. user explicit targets
        if user_id:
            if user_id in flag.get("target_users", set()):
                return True

        # 2. group targeting
        if groups:
            if flag.get("target_groups") and set(groups).intersection(flag.get("target_groups", set())):
                return True

        # 3. percentage rollout
        rollout = int(flag.get("rollout_percentage", 0) or 0)
        if user_id:
            bucket = self._hash_to_percent(key, user_id)
            return bucket < rollout
        return rollout >= 100 and bool(flag.get("default_value", True))


# Convenience small script usable when run directly
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Simple FlagCacheClient quick demo")
    parser.add_argument("--api", default=os.getenv("FEATURE_FLAG_API_URL", "http://localhost:8002/api"), help="API base url")
    parser.add_argument("--interval", type=int, default=30, help="Refresh interval seconds")
    args = parser.parse_args()

    client = FlagCacheClient(api_base_url=args.api, refresh_interval=args.interval)
    print("Refreshing flags once...")
    client.refresh()
    print("Flags cached:", list(client._flags.keys())[:20])
    client.stop()
