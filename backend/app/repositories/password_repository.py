from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import DESCENDING

from app.models.password_entry import PasswordEntry
from app.repositories.base import BaseRepository


class PasswordRepository(BaseRepository[PasswordEntry]):
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        super().__init__(collection, PasswordEntry)

    async def find_by_cabinet(
        self,
        cabinet_id: str,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[PasswordEntry], int]:
        filter_ = {"cabinet_id": cabinet_id}
        return await self.find_all(
            filter_,
            skip=skip,
            limit=limit,
            sort=[("created_at", DESCENDING)],
        )

    async def delete_by_cabinet(self, cabinet_id: str) -> int:
        result = await self._col.delete_many({"cabinet_id": cabinet_id})
        return result.deleted_count
