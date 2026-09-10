

from backend.models.environment import Environment
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from backend.schemas.environment import EnvironmentCreate

def _normalize_environment_payload(data: EnvironmentCreate) -> dict:
    payload = data.model_dump()
    key = (payload.get("key") or payload.get("name") or "").strip()
    if key:
        payload["key"] = key.lower().replace(" ", "_")
    payload["is_active"] = payload.get("is_active", True)
    return payload


def create_environment(database: Session, data: EnvironmentCreate, owner_id: int | None = None):
    environment_instance = Environment(**_normalize_environment_payload(data), owner_id=owner_id)
    database.add(environment_instance)
    database.commit()
    database.refresh(environment_instance)
    return environment_instance


def get_environment(database: Session, owner_id: int | None = None):
    query = database.query(Environment)
    if owner_id is not None:
        query = query.filter(
            or_(Environment.owner_id == owner_id, Environment.owner_id.is_(None))
        )
    return query.order_by(Environment.name.asc()).all()


def get_environment_by_name(database: Session, environment_name: str, owner_id: int | None = None):
    query = database.query(Environment).filter(
        func.lower(Environment.name) == environment_name.lower()
    )
    if owner_id is not None:
        query = query.filter(
            or_(Environment.owner_id == owner_id, Environment.owner_id.is_(None))
        )
    return query.all()


def get_environment_by_key(database: Session, key: str, owner_id: int | None = None):
    query = database.query(Environment).filter(func.lower(Environment.key) == key.strip().lower())
    if owner_id is not None:
        query = query.filter(Environment.owner_id == owner_id)
    return query.first()


def get_environment_by_id(database: Session, environment_id: int, owner_id: int | None = None):
    query = database.query(Environment).filter(Environment.id == environment_id)
    if owner_id is not None:
        query = query.filter(
            or_(Environment.owner_id == owner_id, Environment.owner_id.is_(None))
        )
    return query.first()


def update_environment(
    database: Session,
    environment_id: int,
    data: EnvironmentCreate,
    owner_id: int | None = None,
):
    environment_instance = get_environment_by_id(database, environment_id, owner_id=owner_id)

    if environment_instance is None:
        return None

    for field, value in _normalize_environment_payload(data).items():
        setattr(environment_instance, field, value)

    database.commit()
    database.refresh(environment_instance)
    return environment_instance


def delete_environment(database: Session, environment_id: int, owner_id: int | None = None):
    environment_instance = get_environment_by_id(database, environment_id, owner_id=owner_id)

    if environment_instance is None:
        return None

    database.delete(environment_instance)
    database.commit()
    return environment_instance
