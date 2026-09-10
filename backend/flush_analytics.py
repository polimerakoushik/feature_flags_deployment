"""
Flush analytics counters from Redis (or memory cache) into Postgres evaluation_metrics table.
Run this as a daily cron job or scheduled task.
"""
from datetime import datetime

from backend.database import SessionLocal
from backend.services.cache import cache_service
from sqlalchemy import text


def parse_analytics_key(key: str):
    # expected format: analytics:flag:{flag_key}:{environment}:{YYYYmmddHH}
    parts = key.split(":")
    if len(parts) < 5:
        return None
    _, _, flag_key, environment, bucket = parts[:5]
    try:
        dt = datetime.strptime(bucket, "%Y%m%d%H")
    except Exception:
        return None
    return flag_key, environment, dt


def flush_all():
    data = cache_service.analytics_snapshot() if hasattr(cache_service, 'analytics_snapshot') else {}

    # Redis implementation returns dict keyed by full redis key when pop_analytics implemented there
    if isinstance(data, dict) and data:
        # normalize keys
        entries = []
        for k, v in data.items():
            parsed = parse_analytics_key(k)
            if not parsed:
                continue
            flag_key, environment, bucket = parsed
            try:
                count = int(v)
            except Exception:
                count = 0
            entries.append((flag_key, environment, bucket, count))

        if not entries:
            return

        with SessionLocal() as session:
            with session.begin():
                for flag_key, environment, bucket, count in entries:
                    # upsert into evaluation_metrics
                    stmt = text(
                        "INSERT INTO evaluation_metrics (flag_key, environment, bucket, evaluations) "
                        "VALUES (:flag_key, :environment, :bucket, :count) "
                        "ON CONFLICT (flag_key, environment, bucket) DO UPDATE SET evaluations = evaluation_metrics.evaluations + :count"
                    )
                    session.execute(stmt, {"flag_key": flag_key, "environment": environment, "bucket": bucket, "count": count})

        # Delete counters only after the database transaction commits successfully.
        cache_service.delete_analytics_keys(data.keys())


if __name__ == "__main__":
    flush_all()
