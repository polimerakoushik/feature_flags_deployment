from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import EvaluationMetric, Flag
from backend.models.user import User
from backend.services.auth import get_current_user
from backend.services.cache import cache_service
from backend.config import settings

router = APIRouter(tags=["metrics"])


def _parse_live_metric_key(key: str):
    """Parse analytics:flag:{flag_key}:{environment}:{YYYYmmddHH}."""
    prefix = "analytics:flag:"
    if not key.startswith(prefix):
        return None
    payload = key[len(prefix):]
    try:
        flag_key, environment, bucket_text = payload.rsplit(":", 2)
        bucket = datetime.strptime(bucket_text, "%Y%m%d%H")
    except (ValueError, TypeError):
        return None
    return flag_key, environment, bucket


def _live_counts(*, start: datetime, end: datetime, flag_key: str | None = None, environment: str | None = None):
    """Return unflushed Redis/memory counters so charts update immediately."""
    result = defaultdict(int)
    try:
        snapshot = cache_service.analytics_snapshot()
    except Exception:
        snapshot = {}
    for key, raw_count in snapshot.items():
        parsed = _parse_live_metric_key(key)
        if not parsed:
            continue
        live_flag_key, live_environment, bucket = parsed
        if bucket < start or bucket > end:
            continue
        if flag_key and live_flag_key != flag_key:
            continue
        if environment and live_environment.lower() != environment.lower():
            continue
        try:
            result[(live_flag_key, live_environment, bucket)] += int(raw_count or 0)
        except (TypeError, ValueError):
            continue
    return result


@router.get("/flags/{flag_id}/metrics")
def get_flag_metrics(
    flag_id: int,
    days: int = Query(7, ge=1, le=90),
    environment: str | None = None,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    flag = database.query(Flag).filter(Flag.id == flag_id, Flag.owner_id == current_user.id).first()
    if flag is None:
        raise HTTPException(status_code=404, detail="Flag not found")

    end = datetime.now(ZoneInfo(settings.analytics_timezone)).replace(
        tzinfo=None, minute=0, second=0, microsecond=0
    )
    start = end - timedelta(days=days)

    query = database.query(EvaluationMetric).filter(
        EvaluationMetric.flag_key == flag.key,
        EvaluationMetric.bucket >= start,
        EvaluationMetric.bucket <= end,
    )
    if environment:
        query = query.filter(func.lower(EvaluationMetric.environment) == environment.lower())
    rows = query.order_by(EvaluationMetric.bucket).all()

    counts_by_bucket = defaultdict(int)
    for row in rows:
        bucket = row.bucket.replace(minute=0, second=0, microsecond=0)
        counts_by_bucket[bucket] += int(row.evaluations or 0)

    # Add the counters that have not yet been flushed to PostgreSQL.
    for (_, _, bucket), count in _live_counts(
        start=start,
        end=end,
        flag_key=flag.key,
        environment=environment,
    ).items():
        counts_by_bucket[bucket] += count

    result = []
    bucket_cursor = start
    while bucket_cursor <= end:
        result.append({"bucket": bucket_cursor.isoformat(), "count": counts_by_bucket.get(bucket_cursor, 0)})
        bucket_cursor += timedelta(hours=1)

    return {
        "flag_id": flag_id,
        "flag_key": flag.key,
        "environment": environment,
        "days": days,
        "metrics": result,
    }


@router.get("/metrics/flags/summary")
def get_flags_metrics_summary(
    days: int = Query(7, ge=1, le=90),
    environment: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if start_date and end_date and end_date < start_date:
        raise HTTPException(status_code=400, detail="end_date must not be before start_date")

    if start_date and end_date:
        start = datetime.combine(start_date, datetime.min.time())
        end = datetime.combine(end_date, datetime.max.time()).replace(microsecond=0)
        days = (end_date - start_date).days + 1
    else:
        end = datetime.now(ZoneInfo(settings.analytics_timezone)).replace(
            tzinfo=None, minute=0, second=0, microsecond=0
        )
        start = end - timedelta(days=days)

    owned_flags = database.query(Flag).filter(Flag.owner_id == current_user.id).all()
    owned_by_key = {flag.key: flag for flag in owned_flags}
    if not owned_by_key:
        return {
            "days": days,
            "environment": environment,
            "start_date": start.date().isoformat(),
            "end_date": end.date().isoformat(),
            "start": start.isoformat(),
            "end": end.isoformat(),
            "total_evaluations": 0,
            "owned_flags_count": 0,
            "active_flags_count": 0,
            "flags": [],
            "daily_evaluations": [
                {
                    "date": (
                        end.date() - timedelta(days=days - index - 1)
                    ).isoformat(),
                    "evaluations": 0,
                }
                for index in range(days)
            ],
        }

    query = database.query(
        EvaluationMetric.flag_key,
        EvaluationMetric.environment,
        func.sum(EvaluationMetric.evaluations).label("count"),
    ).filter(
        EvaluationMetric.flag_key.in_(list(owned_by_key.keys())),
        EvaluationMetric.bucket >= start,
        EvaluationMetric.bucket <= end,
    )
    if environment:
        query = query.filter(func.lower(EvaluationMetric.environment) == environment.lower())
    rows = query.group_by(EvaluationMetric.flag_key, EvaluationMetric.environment).all()

    aggregate = defaultdict(int)
    daily_totals = defaultdict(int)
    for row in rows:
        aggregate[(row.flag_key, row.environment)] += int(row.count or 0)

    for (flag_key, env, _bucket), count in _live_counts(start=start, end=end, environment=environment).items():
        if flag_key in owned_by_key:
            aggregate[(flag_key, env)] += count

    metric_rows = database.query(
        EvaluationMetric.bucket,
        func.sum(EvaluationMetric.evaluations).label("count"),
    ).filter(
        EvaluationMetric.flag_key.in_(list(owned_by_key.keys())),
        EvaluationMetric.bucket >= start,
        EvaluationMetric.bucket <= end,
    )
    if environment:
        metric_rows = metric_rows.filter(
            func.lower(EvaluationMetric.environment) == environment.lower()
        )
    for row in metric_rows.group_by(EvaluationMetric.bucket).all():
        daily_totals[row.bucket.date()] += int(row.count or 0)

    for (_, _, bucket), count in _live_counts(
        start=start,
        end=end,
        environment=environment,
    ).items():
        daily_totals[bucket.date()] += count

    by_flag = {}
    total_evaluations = 0
    for (flag_key, env), count in aggregate.items():
        flag = owned_by_key.get(flag_key)
        if not flag:
            continue
        total_evaluations += count
        record = by_flag.setdefault(
            flag.id,
            {"flag_id": flag.id, "flag_key": flag_key, "total": 0, "environments": {}},
        )
        record["total"] += count
        record["environments"][env] = record["environments"].get(env, 0) + count

    result_list = sorted(by_flag.values(), key=lambda item: item["total"], reverse=True)
    return {
        "days": days,
        "environment": environment,
        "start_date": start.date().isoformat(),
        "end_date": end.date().isoformat(),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "total_evaluations": total_evaluations,
        "owned_flags_count": len(owned_flags),
        "active_flags_count": len(result_list),
        "flags": result_list,
        "daily_evaluations": [
            {
                "date": (
                    end.date() - timedelta(days=days - index - 1)
                ).isoformat(),
                "evaluations": daily_totals.get(
                    end.date() - timedelta(days=days - index - 1),
                    0,
                ),
            }
            for index in range(days)
        ],
    }
