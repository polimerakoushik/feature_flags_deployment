from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.crud.user_group import get_group_names
from backend.database import get_db
from backend.models.user import User
from backend.utils.deps import get_current_user

router = APIRouter(prefix="/groups", tags=["groups"])


@router.get("", response_model=list[str])
def list_groups(
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ = current_user
    return get_group_names(database)
