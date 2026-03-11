from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models.user import Role


def _empty_str_to_none(v: object) -> object:
    if isinstance(v, str) and not v.strip():
        return None
    return v


class RegisterRequest(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_.-]+$",
        description="Alphanumeric, underscores, dots, and hyphens only",
    )
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    note: Optional[str] = Field(None, max_length=500)

    _normalise_email = field_validator("email", mode="before")(_empty_str_to_none)


class ApproveRequest(BaseModel):
    role: Role
    cabinet_ids: list[str] = []


class RejectRequest(BaseModel):
    reason: Optional[str] = Field(None, max_length=500)
