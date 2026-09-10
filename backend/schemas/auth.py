from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator


class SignupRequest(BaseModel):
    name: str = Field(min_length=1)
    email: EmailStr
    phone: str | None = Field(default=None, min_length=7, max_length=15)
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    role: str = "Developer"
    password: str
    company: str | None = None

    @model_validator(mode="after")
    def validate_password(self):
        errors = []
        if len(self.password) < 8:
            errors.append("Password must be at least 8 characters long.")
        if not any(character.isupper() for character in self.password):
            errors.append("Password must contain at least one uppercase letter.")
        if not any(character.isdigit() for character in self.password):
            errors.append("Password must contain at least one number.")
        if errors:
            raise ValueError(" ".join(errors))
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, min_length=7, max_length=15)
    age: int | None = Field(default=None, ge=1, le=120)
    gender: str | None = None
    role: str | None = None
    company: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    phone: str | None = None
    age: int | None = None
    gender: str | None = None
    company: str | None = None
    role: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
