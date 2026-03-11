import re
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator

_NAME_PATTERN = re.compile(r"^[\w\s\-\.]+$")


class CabinetCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    member_usernames: list[str] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not _NAME_PATTERN.match(v):
            raise ValueError("Cabinet name may only contain letters, digits, spaces, hyphens, underscores, and dots")
        return v


class CabinetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not _NAME_PATTERN.match(v):
            raise ValueError("Cabinet name may only contain letters, digits, spaces, hyphens, underscores, and dots")
        return v


class MembersUpdate(BaseModel):
    usernames: list[str] = Field(min_length=1)


class CabinetResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    member_usernames: list[str]
    entry_count: int = 0
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str
