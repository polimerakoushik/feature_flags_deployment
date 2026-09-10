from sqlalchemy.orm import Session

from backend.models.flag_version import FlagVersion
from backend.models.flag import Flag
from backend.schemas.flag_version import FlagVersionCreate


def create_flag_version(database: Session, data: FlagVersionCreate):
    flag_version_instance = FlagVersion(**data.model_dump())
    database.add(flag_version_instance)
    database.commit()
    database.refresh(flag_version_instance)
    return flag_version_instance


def get_flag_versions(database: Session, owner_user_id: int | None = None):
    query = database.query(FlagVersion)
    if owner_user_id is not None:
        query = query.join(Flag, FlagVersion.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.all()


def get_flag_version_by_id(database: Session, flag_version_id: int, owner_user_id: int | None = None):
    query = database.query(FlagVersion).filter(FlagVersion.id == flag_version_id)
    if owner_user_id is not None:
        query = query.join(Flag, FlagVersion.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.first()


def get_flag_versions_by_flag_id(database: Session, flag_id: int, owner_user_id: int | None = None):
    query = database.query(FlagVersion).filter(FlagVersion.flag_id == flag_id)
    if owner_user_id is not None:
        query = query.join(Flag, FlagVersion.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.order_by(FlagVersion.version.desc()).all()


def update_flag_version(
    database: Session,
    flag_version_id: int,
    data: FlagVersionCreate,
    owner_user_id: int | None = None,
):
    flag_version_instance = get_flag_version_by_id(database, flag_version_id, owner_user_id)

    if flag_version_instance is None:
        return None

    for field, value in data.model_dump().items():
        setattr(flag_version_instance, field, value)

    database.commit()
    database.refresh(flag_version_instance)
    return flag_version_instance


def delete_flag_version(database: Session, flag_version_id: int, owner_user_id: int | None = None):
    flag_version_instance = get_flag_version_by_id(database, flag_version_id, owner_user_id)

    if flag_version_instance is None:
        return None

    database.delete(flag_version_instance)
    database.commit()
    return flag_version_instance
