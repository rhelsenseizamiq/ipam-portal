from motor.motor_asyncio import AsyncIOMotorCollection

from app.models.cabinet import Cabinet
from app.repositories.base import BaseRepository


class CabinetRepository(BaseRepository[Cabinet]):
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        super().__init__(collection, Cabinet)

    async def find_by_name(self, name: str) -> Cabinet | None:
        doc = await self._col.find_one({"name": name})
        return self._doc_to_model(doc) if doc else None

    async def find_by_member(self, username: str) -> list[Cabinet]:
        cursor = self._col.find({"member_usernames": username})
        docs = await cursor.to_list(length=None)
        return [self._doc_to_model(doc) for doc in docs]

    async def add_member(self, cabinet_id: str, username: str) -> Cabinet | None:
        try:
            oid = self._obj_id(cabinet_id)
        except ValueError:
            return None
        from pymongo import ReturnDocument
        updated = await self._col.find_one_and_update(
            {"_id": oid},
            {"$addToSet": {"member_usernames": username}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_model(updated) if updated else None

    async def remove_member(self, cabinet_id: str, username: str) -> Cabinet | None:
        try:
            oid = self._obj_id(cabinet_id)
        except ValueError:
            return None
        from pymongo import ReturnDocument
        updated = await self._col.find_one_and_update(
            {"_id": oid},
            {"$pull": {"member_usernames": username}},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_model(updated) if updated else None
