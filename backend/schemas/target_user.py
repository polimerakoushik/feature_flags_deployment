from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class TargetUserBase(BaseModel):
    user_id: str


class TargetUserCreate(TargetUserBase):
    pass


class TargetUser(TargetUserBase):
    id: int
    flag_id: int
    created_at: Optional[datetime]

    class Config:
        orm_mode = True
