from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, min_length=7, max_length=15)
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    company: str | None = None
    role: str = "Developer"
    password: str = Field(min_length=8)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    company: str | None = None
    role: str | None = None
    profile_image: str | None = None


class User(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    company: str | None = None
    role: str
    profile_image: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

