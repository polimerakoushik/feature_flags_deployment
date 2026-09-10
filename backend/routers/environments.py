from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.crud import environment as environment_crud
from backend.database import get_db
from backend.models.user import User
from backend.schemas.environment import Environment, EnvironmentCreate
from backend.utils.deps import get_current_user

router = APIRouter(prefix="/environments", tags=["environments"])


@router.get("", response_model=list[Environment])
def list_environments(
    name: str | None = None,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if name is not None:
        return environment_crud.get_environment_by_name(database, name, owner_id=current_user.id)
    return environment_crud.get_environment(database, owner_id=current_user.id)


@router.post("", response_model=Environment, status_code=status.HTTP_201_CREATED)
def create_environment(
    data: EnvironmentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        return environment_crud.create_environment(database, data, owner_id=current_user.id)
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Environment key already exists.")


@router.get("/{environment_id}", response_model=Environment)
def get_environment(
    environment_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    environment = environment_crud.get_environment_by_id(database, environment_id, owner_id=current_user.id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


@router.put("/{environment_id}", response_model=Environment)
def update_environment(
    environment_id: int,
    data: EnvironmentCreate,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        environment = environment_crud.update_environment(database, environment_id, data, owner_id=current_user.id)
    except IntegrityError:
        database.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Environment key already exists.")
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
    return environment


@router.delete("/{environment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    environment_id: int,
    database: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    environment = environment_crud.delete_environment(database, environment_id, owner_id=current_user.id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")
