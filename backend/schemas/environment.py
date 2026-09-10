from pydantic import BaseModel, ConfigDict, field_validator


class EnvironmentBase(BaseModel):
    name: str
    key: str | None = None
    description: str | None = None
    is_active: bool = True

    @field_validator("key")
    @classmethod
    def normalize_key(cls, value, info):
        if value is None:
            name = info.data.get("name")
            if not name:
                return value
            return name.strip().lower().replace(" ", "_")
        value = value.strip()
        if not value:
            name = info.data.get("name")
            if not name:
                return value
            return name.strip().lower().replace(" ", "_")
        return value.lower().replace(" ", "_")


class EnvironmentCreate(EnvironmentBase):
    pass


class Environment(EnvironmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
