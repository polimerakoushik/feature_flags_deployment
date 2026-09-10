from pydantic import BaseModel


class UserGroupMembershipBase(BaseModel):
    user_id: str
    group_id: int


class UserGroupMembershipCreate(UserGroupMembershipBase):
    pass


class UserGroupMembership(UserGroupMembershipBase):
    id: int

    class Config:
        from_attributes = True
