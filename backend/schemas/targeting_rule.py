from pydantic import BaseModel


class TargetingRuleBase(BaseModel):
    flag_id: int
    attribute: str
    operator: str
    value: str
    is_active: bool = True


class TargetingRuleCreate(TargetingRuleBase):
    pass


class TargetingRule(TargetingRuleBase):
    id: int

    class Config:
        from_attributes = True
