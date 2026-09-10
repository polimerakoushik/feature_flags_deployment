from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.crud import flag as flag_crud
from backend.crud import flag_version as flag_version_crud
from backend.database import get_db
from backend.models.user import User
from backend.schemas.flag_version import FlagVersion, FlagVersionCreate
from backend.services.auth import get_current_user

router = APIRouter(prefix="/flag-versions", tags=["flag versions"])


@router.get("", response_model=list[FlagVersion])
def list_flag_versions(flag_id: int | None = None, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if flag_id is not None:
        return flag_version_crud.get_flag_versions_by_flag_id(database, flag_id, current_user.id)
    return flag_version_crud.get_flag_versions(database, current_user.id)


@router.post("", response_model=FlagVersion, status_code=status.HTTP_201_CREATED)
def create_flag_version(data: FlagVersionCreate, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if flag_crud.get_flag_by_id(database, data.flag_id, current_user.id) is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return flag_version_crud.create_flag_version(database, data)


@router.get("/{flag_version_id}", response_model=FlagVersion)
def get_flag_version(flag_version_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    version = flag_version_crud.get_flag_version_by_id(database, flag_version_id, current_user.id)
    if version is None:
        raise HTTPException(status_code=404, detail="Flag version not found")
    return version


@router.put("/{flag_version_id}", response_model=FlagVersion)
def update_flag_version(flag_version_id: int, data: FlagVersionCreate, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    version = flag_version_crud.update_flag_version(database, flag_version_id, data, current_user.id)
    if version is None:
        raise HTTPException(status_code=404, detail="Flag version not found")
    return version


@router.delete("/{flag_version_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_flag_version(flag_version_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    version = flag_version_crud.delete_flag_version(database, flag_version_id, current_user.id)
    if version is None:
        raise HTTPException(status_code=404, detail="Flag version not found")
