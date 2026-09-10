from sqlalchemy import Column, Integer, String

from backend.database import Base


class UserGroup(Base):
    """A named group used by targeting rules and group memberships."""

    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True, index=True)
