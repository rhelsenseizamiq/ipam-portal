from dataclasses import dataclass
from fastapi import Query


@dataclass
class PaginationParams:
    page: int = Query(1, ge=1, description="Page number (1-based)")
    page_size: int = Query(50, ge=1, le=200, description="Number of items per page")

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.page_size
