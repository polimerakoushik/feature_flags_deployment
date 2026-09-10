from sqlalchemy.orm import Session

from backend.models.flag_target_group import FlagTargetGroup
from backend.models.user_group import UserGroup
from backend.models.user_group_membership import UserGroupMembership


def get_target_groups_by_flag_id(database: Session, flag_id: int):
    query = database.query(FlagTargetGroup).filter(FlagTargetGroup.flag_id == flag_id)
    return query.order_by(FlagTargetGroup.created_at.desc()).all()


def get_target_group_names_by_flag_id(database: Session, flag_id: int) -> list[str]:
    return [row.group_name for row in get_target_groups_by_flag_id(database, flag_id)]


def create_target_group(database: Session, flag_id: int, group_name: str):
    normalized_group_name = group_name.strip()
    existing = (
        database.query(FlagTargetGroup)
        .filter(
            FlagTargetGroup.flag_id == flag_id,
            FlagTargetGroup.group_name == normalized_group_name,
        )
        .first()
    )
    if existing:
        return None

    instance = FlagTargetGroup(flag_id=flag_id, group_name=normalized_group_name)
    database.add(instance)
    database.commit()
    database.refresh(instance)
    return instance


def delete_target_group(database: Session, flag_id: int, group_name: str):
    normalized_group_name = group_name.strip()
    instance = (
        database.query(FlagTargetGroup)
        .filter(
            FlagTargetGroup.flag_id == flag_id,
            FlagTargetGroup.group_name == normalized_group_name,
        )
        .first()
    )
    if instance is None:
        return None
    database.delete(instance)
    database.commit()
    return instance


def user_in_target_group(database: Session, flag_id: int, user_id: str) -> bool:
    target_group_names = set(get_target_group_names_by_flag_id(database, flag_id))
    if not target_group_names:
        return False

    memberships = (
        database.query(UserGroup.name)
        .join(UserGroupMembership, UserGroup.id == UserGroupMembership.group_id)
        .filter(UserGroupMembership.user_id == str(user_id))
        .all()
    )
    user_group_names = {name for (name,) in memberships}
    return bool(target_group_names & user_group_names)
