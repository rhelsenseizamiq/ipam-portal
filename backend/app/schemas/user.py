from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field, EmailStr

from app.models.user import Role


class UserCreate(BaseModel):
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
    role: Role


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    role: Optional[Role] = None


class UserResetPassword(BaseModel):
    new_password: str = Field(..., min_length=8, max_length=128)


class UserResponse(BaseModel):
    """Public user representation. Never exposes password_hash."""

    id: str
    username: str
    full_name: str
    email: Optional[str]
    role: Role
    is_active: bool
    created_at: datetime
    updated_at: datetime
    created_by: str
    last_login: Optional[datetime]
