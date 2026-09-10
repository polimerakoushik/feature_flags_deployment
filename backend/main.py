import logging
import os
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

if __package__ in (None, ""):
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    if repo_root not in sys.path:
        sys.path.insert(0, repo_root)

from backend import models  # noqa: F401
from backend.config import settings
from backend.database import check_database_connection
from backend.routers import audit, auth, cleanup, environments, evaluation, flag_versions, flags, groups, metrics, targeting, user_group_memberships
from backend.routers.user import router as user_router
from backend.services.cache import cache_service


logger = logging.getLogger("uvicorn")

app = FastAPI(
    title=settings.app_name,
    version="2.0.0",
    description="Feature flag platform with auth, targeting, rollout, analytics, and cleanup workflows.",
)


@app.on_event("startup")
def on_startup():
    database_ok, database_error = check_database_connection()
    if not database_ok:
        logger.error("Database connection failed during startup: %s", database_error)
    else:
        logger.info("Database connection verified successfully.")


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(auth.router, prefix="/api")
app.include_router(environments.router)
app.include_router(environments.router, prefix="/api")
app.include_router(flags.router)
app.include_router(flags.router, prefix="/api")
app.include_router(groups.router)
app.include_router(groups.router, prefix="/api")
app.include_router(flag_versions.router)
app.include_router(flag_versions.router, prefix="/api")
app.include_router(targeting.router)
app.include_router(targeting.router, prefix="/api")
app.include_router(user_group_memberships.router)
app.include_router(user_group_memberships.router, prefix="/api")
app.include_router(audit.router)
app.include_router(audit.router, prefix="/api")
app.include_router(evaluation.router)
app.include_router(evaluation.router, prefix="/api")
app.include_router(metrics.router)
app.include_router(metrics.router, prefix="/api")
app.include_router(cleanup.router)
app.include_router(cleanup.router, prefix="/api")
app.include_router(user_router)
app.include_router(user_router, prefix="/api")

@app.get("/")
def root():
    return {"message": "FeatureFlow API is running"}


@app.get("/health")
def health():
    database_ok, database_error = check_database_connection()
    redis_status = cache_service.health()
    return {
        "status": "ok" if database_ok and redis_status == "connected" else "degraded",
        "database": "connected" if database_ok else "unavailable",
        "redis": redis_status,
        "database_error": database_error,
    }
