import math
from typing import Any, Generic, Optional, TypeVar
from datetime import datetime
from pydantic import BaseModel

from app.models.audit_log import AuditAction, ResourceType

T = TypeVar("T")


class AuditLogResponse(BaseModel):
    id: str
    action: AuditAction
    resource_type: ResourceType
    resource_id: Optional[str]
    username: str
    user_role: str
    client_ip: str
    timestamp: datetime
    before: Optional[dict[str, Any]]
    after: Optional[dict[str, Any]]
    detail: Optional[str]


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(cls, items: list, total: int, page: int, page_size: int) -> "PaginatedResponse":
        pages = math.ceil(total / page_size) if page_size > 0 else 0
        return cls(items=items, total=total, page=page, page_size=page_size, pages=pages)
