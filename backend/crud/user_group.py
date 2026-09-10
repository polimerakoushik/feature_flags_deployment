from sqlalchemy.orm import Session

from backend.models.user_group import UserGroup


def get_groups(database: Session):
    return database.query(UserGroup).order_by(UserGroup.name.asc()).all()


def get_group_names(database: Session) -> list[str]:
    return [group.name for group in get_groups(database)]


def get_group_by_name(database: Session, name: str):
    return database.query(UserGroup).filter(UserGroup.name == name).first()
