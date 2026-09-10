from sqlalchemy.orm import Session

from backend.models.targeting_rule import TargetingRule
from backend.models.flag import Flag
from backend.schemas.targeting_rule import TargetingRuleCreate


def create_targeting_rule(database: Session, data: TargetingRuleCreate):
    targeting_rule_instance = TargetingRule(**data.model_dump())
    database.add(targeting_rule_instance)
    database.commit()
    database.refresh(targeting_rule_instance)
    return targeting_rule_instance


def get_targeting_rules(database: Session, owner_user_id: int | None = None):
    query = database.query(TargetingRule)
    if owner_user_id is not None:
        query = query.join(Flag, TargetingRule.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.all()


def get_targeting_rule_by_id(database: Session, targeting_rule_id: int, owner_user_id: int | None = None):
    query = database.query(TargetingRule).filter(TargetingRule.id == targeting_rule_id)
    if owner_user_id is not None:
        query = query.join(Flag, TargetingRule.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.first()


def get_targeting_rules_by_flag_id(database: Session, flag_id: int, owner_user_id: int | None = None):
    query = database.query(TargetingRule).filter(TargetingRule.flag_id == flag_id)
    if owner_user_id is not None:
        query = query.join(Flag, TargetingRule.flag_id == Flag.id).filter(Flag.owner_user_id == owner_user_id)
    return query.all()


def update_targeting_rule(
    database: Session,
    targeting_rule_id: int,
    data: TargetingRuleCreate,
    owner_user_id: int | None = None,
):
    targeting_rule_instance = get_targeting_rule_by_id(
        database,
        targeting_rule_id,
        owner_user_id,
    )

    if targeting_rule_instance is None:
        return None

    for field, value in data.model_dump().items():
        setattr(targeting_rule_instance, field, value)

    database.commit()
    database.refresh(targeting_rule_instance)
    return targeting_rule_instance


def delete_targeting_rule(database: Session, targeting_rule_id: int, owner_user_id: int | None = None):
    targeting_rule_instance = get_targeting_rule_by_id(
        database,
        targeting_rule_id,
        owner_user_id,
    )

    if targeting_rule_instance is None:
        return None

    database.delete(targeting_rule_instance)
    database.commit()
    return targeting_rule_instance
