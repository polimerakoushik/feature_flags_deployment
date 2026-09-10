from fastapi import APIRouter, Depends, HTTPException, status, Query
from datetime import datetime
from typing import Optional
from sqlalchemy.orm import Session

from backend.crud import audit_log as audit_crud
from backend.database import get_db
from backend.models.user import User
from backend.schemas.audit_log import AuditLog, AuditLogCreate, AuditLogPage
from backend.utils.deps import get_current_user

router = APIRouter(prefix="/audit-logs", tags=["audit logs"])


@router.get("", response_model=AuditLogPage)
def list_audit_logs(
    actor: Optional[str] = Query(None, description="Filter by actor (user/email)"),
    flag_key: Optional[str] = Query(None, description="Filter by flag key"),
    search: Optional[str] = Query(None, description="Search by actor or flag key"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    environment: Optional[str] = Query(None, description="Filter by environment"),
    start_date: Optional[datetime] = Query(None, description="ISO start date"),
    end_date: Optional[datetime] = Query(None, description="ISO end date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=1000),
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sd = start_date.isoformat() if start_date else None
    ed = end_date.isoformat() if end_date else None
    result = audit_crud.get_audit_logs(
        database,
        owner_user_id=current_user.id,
        actor=actor,
        entity_name=flag_key,
        search=search,
        action=action,
        environment=environment,
        start_date=sd,
        end_date=ed,
        page=page,
        page_size=page_size,
    )
    return result


@router.post("", response_model=AuditLog, status_code=status.HTTP_201_CREATED)
def create_audit_log(
    data: AuditLogCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return audit_crud.create_audit_log(database, data, owner_user_id=current_user.id)


@router.get("/{audit_log_id}", response_model=AuditLog)
def get_audit_log(
    audit_log_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    audit_log = audit_crud.get_audit_log_by_id(database, audit_log_id, owner_user_id=current_user.id)
    if audit_log is None:
        raise HTTPException(status_code=404, detail="Audit log not found")
    return audit_log
