from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from backend.models.flag_target_user import FlagTargetUser


def get_target_users_by_flag_id(database: Session, flag_id: int):
    query = database.query(FlagTargetUser).filter(FlagTargetUser.flag_id == flag_id)
    return query.order_by(FlagTargetUser.created_at.desc()).all()


def create_target_user(database: Session, flag_id: int, user_id: str):
    normalized_user_id = user_id.strip()
    # Prevent duplicates at application level
    existing = (
        database.query(FlagTargetUser)
        .filter(FlagTargetUser.flag_id == flag_id, FlagTargetUser.user_id == normalized_user_id)
        .first()
    )
    if existing:
        return None
    instance = FlagTargetUser(flag_id=flag_id, user_id=normalized_user_id)
    database.add(instance)
    try:
        database.commit()
    except IntegrityError:
        database.rollback()
        return None
    database.refresh(instance)
    return instance


def delete_target_user(database: Session, flag_id: int, user_id: str):
    normalized_user_id = user_id.strip()
    instance = (
        database.query(FlagTargetUser)
        .filter(FlagTargetUser.flag_id == flag_id, FlagTargetUser.user_id == normalized_user_id)
        .first()
    )
    if instance is None:
        return None
    database.delete(instance)
    database.commit()
    return instance
