from __future__ import annotations

import os
from typing import List

from fastapi import FastAPI, Query

from backend.utils.flag_middleware import FlagCacheClient


def create_app() -> FastAPI:
    api_base_url = os.getenv("FEATURE_FLAG_API_URL", "http://localhost:8002/api")
    cache = FlagCacheClient(
        api_base_url=api_base_url,
        refresh_interval=30,
        auth_token=os.getenv("FEATURE_FLAG_API_TOKEN"),
    )
    cache.start(background=True)

    app = FastAPI(title="Demo consumer app", version="1.0.0")

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok", "cached_flags": len(cache._flags)}

    @app.get("/checkout")
    def checkout(
        user_id: str = "anonymous",
        groups: List[str] = Query(default_factory=list),
    ) -> dict:
        allowed = cache.evaluate(
            "new-checkout",
            user_id=user_id or None,
            groups=groups or None,
            environment="production",
        )
        return {
            "enabled": allowed,
            "user_id": user_id,
            "groups": groups,
            "source": "cached flag evaluation",
        }

    @app.on_event("shutdown")
    def shutdown() -> None:
        cache.stop()

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=9001)
