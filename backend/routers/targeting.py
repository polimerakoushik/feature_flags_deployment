from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.crud import flag as flag_crud
from backend.crud import targeting_rules as targeting_crud
from backend.database import get_db
from backend.models.user import User
from backend.schemas.targeting_rule import TargetingRule, TargetingRuleCreate
from backend.services.auth import get_current_user

router = APIRouter(prefix="/targeting-rules", tags=["targeting rules"])


@router.get("", response_model=list[TargetingRule])
def list_targeting_rules(flag_id: int | None = None, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if flag_id is not None:
        return targeting_crud.get_targeting_rules_by_flag_id(database, flag_id, current_user.id)
    return targeting_crud.get_targeting_rules(database, current_user.id)


@router.post("", response_model=TargetingRule, status_code=status.HTTP_201_CREATED)
def create_targeting_rule(data: TargetingRuleCreate, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if flag_crud.get_flag_by_id(database, data.flag_id, current_user.id) is None:
        raise HTTPException(status_code=404, detail="Flag not found")
    return targeting_crud.create_targeting_rule(database, data)


@router.get("/{targeting_rule_id}", response_model=TargetingRule)
def get_targeting_rule(targeting_rule_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = targeting_crud.get_targeting_rule_by_id(database, targeting_rule_id, current_user.id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Targeting rule not found")
    return rule


@router.put("/{targeting_rule_id}", response_model=TargetingRule)
def update_targeting_rule(targeting_rule_id: int, data: TargetingRuleCreate, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = targeting_crud.update_targeting_rule(database, targeting_rule_id, data, current_user.id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Targeting rule not found")
    return rule


@router.delete("/{targeting_rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_targeting_rule(targeting_rule_id: int, database: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rule = targeting_crud.delete_targeting_rule(database, targeting_rule_id, current_user.id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Targeting rule not found")
