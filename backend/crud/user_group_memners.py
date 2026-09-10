from sqlalchemy.orm import Session

from backend.models.user_group_membership import UserGroupMembership
from backend.schemas.user_group_membership import UserGroupMembershipCreate


def create_user_group_membership(
    database: Session,
    data: UserGroupMembershipCreate,
):
    membership_instance = UserGroupMembership(**data.model_dump())
    database.add(membership_instance)
    database.commit()
    database.refresh(membership_instance)
    return membership_instance


def get_user_group_memberships(database: Session):
    return database.query(UserGroupMembership).all()


def get_user_group_membership_by_id(database: Session, membership_id: int):
    return (
        database.query(UserGroupMembership)
        .filter(UserGroupMembership.id == membership_id)
        .first()
    )


def get_memberships_by_user_id(database: Session, user_id: str):
    return (
        database.query(UserGroupMembership)
        .filter(UserGroupMembership.user_id == user_id)
        .all()
    )


def get_memberships_by_group_id(database: Session, group_id: int):
    return (
        database.query(UserGroupMembership)
        .filter(UserGroupMembership.group_id == group_id)
        .all()
    )


def delete_user_group_membership(database: Session, membership_id: int):
    membership_instance = get_user_group_membership_by_id(
        database,
        membership_id,
    )

    if membership_instance is None:
        return None

    database.delete(membership_instance)
    database.commit()
    return membership_instance