from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.crud import user_group_memners as membership_crud
from backend.database import get_db
from backend.models.user import User
from backend.schemas.user_group_membership import UserGroupMembership, UserGroupMembershipCreate
from backend.services.auth import get_current_user

router = APIRouter(prefix="/user-group-memberships", tags=["user group memberships"])


@router.get("", response_model=list[UserGroupMembership])
def list_memberships(
    user_id: str | None = None,
    group_id: int | None = None,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user_id = str(current_user.id)
    if user_id is not None and user_id != current_user_id:
        return []
    if group_id is not None:
        return [
            membership
            for membership in membership_crud.get_memberships_by_group_id(database, group_id)
            if membership.user_id == current_user_id
        ]
    return membership_crud.get_memberships_by_user_id(database, current_user_id)


@router.post("", response_model=UserGroupMembership, status_code=status.HTTP_201_CREATED)
def create_membership(data: UserGroupMembershipCreate, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return membership_crud.create_user_group_membership(
        database,
        data.model_copy(update={"user_id": str(current_user.id)}),
    )


@router.get("/{membership_id}", response_model=UserGroupMembership)
def get_membership(membership_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    membership = membership_crud.get_user_group_membership_by_id(database, membership_id)
    if membership is None or membership.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="User group membership not found")
    return membership


@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_membership(membership_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = membership_crud.get_user_group_membership_by_id(database, membership_id)
    if existing is None or existing.user_id != str(current_user.id):
        raise HTTPException(status_code=404, detail="User group membership not found")
    membership = membership_crud.delete_user_group_membership(database, membership_id)
    if membership is None:
        raise HTTPException(status_code=404, detail="User group membership not found")
