from sqlalchemy import or_
from sqlalchemy.orm import Session
from backend.models.audit_log import AuditLog
from backend.schemas.audit_log import AuditLogCreate


def create_audit_log(database: Session, data: AuditLogCreate, owner_user_id: int | None = None):
    audit_log_instance = AuditLog(
        **data.model_dump(),
        owner_user_id=owner_user_id,
    )
    database.add(audit_log_instance)
    database.commit()
    database.refresh(audit_log_instance)
    return audit_log_instance


def get_audit_logs(
    database: Session,
    owner_user_id: int | None = None,
    entity_type: str | None = None,
    entity_id: int | None = None,
    actor: str | None = None,
    entity_name: str | None = None,
    search: str | None = None,
    action: str | None = None,
    environment: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    page: int = 1,
    page_size: int = 50,
):
    query = database.query(AuditLog)
    if owner_user_id is not None:
        query = query.filter(AuditLog.owner_user_id == owner_user_id)
    if entity_type is not None:
        query = query.filter(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        query = query.filter(AuditLog.entity_id == entity_id)
    if actor:
        query = query.filter(AuditLog.actor.ilike(f"%{actor}%"))
    if entity_name:
        query = query.filter(AuditLog.entity_name.ilike(f"%{entity_name}%"))
    if search:
        query = query.filter(
            or_(
                AuditLog.actor.ilike(f"%{search}%"),
                AuditLog.entity_name.ilike(f"%{search}%"),
            )
        )
    if action:
        query = query.filter(AuditLog.action == action)
    if environment:
        query = query.filter(AuditLog.environment.ilike(f"%{environment}%"))
    if start_date:
        try:
            from datetime import datetime

            sd = datetime.fromisoformat(start_date)
            query = query.filter(AuditLog.created_at >= sd)
        except Exception:
            pass
    if end_date:
        try:
            from datetime import datetime

            ed = datetime.fromisoformat(end_date)
            query = query.filter(AuditLog.created_at <= ed)
        except Exception:
            pass

    total = query.count()
    page = max(1, int(page or 1))
    page_size = max(1, min(1000, int(page_size or 50)))
    items = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": items, "total": total, "page": page, "page_size": page_size}


def get_audit_log_by_id(database: Session, audit_log_id: int, owner_user_id: int | None = None):
    query = database.query(AuditLog).filter(AuditLog.id == audit_log_id)
    if owner_user_id is not None:
        query = query.filter(AuditLog.owner_user_id == owner_user_id)
    return query.first()