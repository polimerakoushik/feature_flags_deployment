from sqlalchemy.orm import Session

from backend.models.flag import Flag
from backend.schemas.flag import FlagCreate


def _flag_payload(data: FlagCreate):
    flag_columns = {column.name for column in Flag.__table__.columns}
    return {
        key: value
        for key, value in data.model_dump().items()
        if key in flag_columns and key not in {"id", "owner_id"}
    }


def create_flag(database: Session, data: FlagCreate, owner_id: int | None = None):
    flag_instance = Flag(**_flag_payload(data), owner_id=owner_id)
    database.add(flag_instance)
    database.commit()
    database.refresh(flag_instance)
    return flag_instance


def get_flags(database: Session, owner_id: int | None = None):
    query = database.query(Flag)
    if owner_id is not None:
        query = query.filter(Flag.owner_id == owner_id)
    return query.all()


def get_flag_by_id(database: Session, flag_id: int, owner_id: int | None = None):
    query = database.query(Flag).filter(Flag.id == flag_id)
    if owner_id is not None:
        query = query.filter(Flag.owner_id == owner_id)
    return query.first()


def get_flag_by_key(database: Session, key: str, owner_id: int | None = None):
    query = database.query(Flag).filter(Flag.key == key)
    if owner_id is not None:
        query = query.filter(Flag.owner_id == owner_id)
    return query.first()


def update_flag(database: Session, flag_id: int, data: FlagCreate, owner_id: int | None = None):
    flag_instance = get_flag_by_id(database, flag_id, owner_id=owner_id)

    if flag_instance is None:
        return None

    for field, value in _flag_payload(data).items():
        # A flag is permanently scoped to its creation environment.
        if field in {"environment", "environment_id"}:
            continue
        setattr(flag_instance, field, value)

    database.commit()
    database.refresh(flag_instance)
    return flag_instance


def delete_flag(database: Session, flag_id: int, owner_id: int | None = None):
    flag_instance = get_flag_by_id(database, flag_id, owner_id=owner_id)

    if flag_instance is None:
        return None

    database.delete(flag_instance)
    database.commit()
    return flag_instance
