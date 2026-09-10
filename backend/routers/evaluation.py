from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.schemas.evaluation import EvaluateFlagRequest, EvaluateFlagResponse, EvaluateValueResponse
from backend.services.auth import get_current_user
from backend.services.cache import cache_service
from backend.services.evaluation_service import EvaluationService
from backend.models.evaluation_metric import EvaluationMetric
from backend.config import settings

router = APIRouter(tags=["evaluation"])


def _record_persistent_evaluation(
    database: Session,
    *,
    flag_id: int,
    flag_key: str,
    environment: str,
) -> None:
    """Persist the hourly evaluation counter so it survives process restarts."""
    bucket = datetime.now(ZoneInfo(settings.analytics_timezone)).replace(
        minute=0, second=0, microsecond=0, tzinfo=None
    )
    metric = (
        database.query(EvaluationMetric)
        .filter(
            EvaluationMetric.flag_key == flag_key,
            EvaluationMetric.environment == environment,
            EvaluationMetric.bucket == bucket,
        )
        .first()
    )
    if metric is None:
        database.add(
            EvaluationMetric(
                flag_id=flag_id,
                flag_key=flag_key,
                environment=environment,
                bucket=bucket,
                evaluations=1,
            )
        )
    else:
        metric.evaluations = int(metric.evaluations or 0) + 1
        if metric.flag_id is None:
            metric.flag_id = flag_id
    database.commit()


def _evaluate_and_serialize(database: Session, *, flag_key: str, environment: str, user_id: str | None, groups: list[str], user_context: dict | None, owner_user_id: int | None):
    service = EvaluationService(database)
    flag = service.get_flag(flag_key, owner_user_id=owner_user_id)
    if flag is None:
        raise ValueError(f"Flag '{flag_key}' not found")

    environment_record = service.find_environment(environment, owner_user_id=owner_user_id)
    override = service.evaluate_environment_override(flag, environment_record)
    cache_token = "|".join(
        str(value)
        for value in (
            getattr(flag, "id", ""),
            getattr(flag, "default_value", ""),
            getattr(flag, "enabled", ""),
            getattr(flag, "rollout_percentage", ""),
            getattr(flag, "updated_at", ""),
            getattr(flag, "created_at", ""),
            getattr(override, "id", ""),
            getattr(override, "value", ""),
            getattr(override, "enabled", ""),
            getattr(override, "rollout_percentage", ""),
            getattr(override, "updated_at", ""),
        )
    )
    cache_key = cache_service.make_evaluation_key(flag_key, environment, user_id, groups, flag_context=cache_token)
    # Persist every request, including cache hits, so analytics survive relogin
    # and backend restarts.
    _record_persistent_evaluation(
        database,
        flag_id=flag.id,
        flag_key=flag_key,
        environment=environment,
    )

    cached_result = cache_service.get(cache_key)
    if cached_result is not None:
        cached_result = dict(cached_result)
        cached_result["cached"] = True
        return cached_result

    result = service.evaluate(
        flag_key=flag_key,
        environment=environment,
        user_id=user_id,
        groups=groups,
        user_context=user_context,
        owner_user_id=owner_user_id,
    )
    cache_service.set(cache_key, result, ttl=60)
    result["cached"] = False
    return result


@router.get("/evaluate", response_model=EvaluateValueResponse)
@router.get("/api/evaluate", response_model=EvaluateValueResponse)
def get_feature_flag_evaluation(
    flag_key: str = Query(..., min_length=1),
    environment: str = Query(..., min_length=1),
    user_id: str | None = Query(default=None),
    groups: list[str] = Query(default_factory=list),
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = _evaluate_and_serialize(
            database,
            flag_key=flag_key,
            environment=environment,
            user_id=user_id,
            groups=groups,
            user_context={},
            owner_user_id=current_user.id,
        )
        return {"value": bool(result["value"])}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/evaluate", response_model=EvaluateValueResponse)
@router.post("/api/evaluate", response_model=EvaluateValueResponse)
def evaluate_feature_flag(
    payload: EvaluateFlagRequest,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        result = _evaluate_and_serialize(
            database,
            flag_key=payload.flag_key,
            environment=payload.environment,
            user_id=payload.user_id or (payload.user_context or {}).get("user_id") or (payload.user_context or {}).get("userId"),
            groups=payload.groups or (payload.user_context or {}).get("groups", []),
            user_context=payload.user_context,
            owner_user_id=current_user.id,
        )
        return {"value": bool(result["value"])}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
