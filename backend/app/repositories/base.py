import logging
from typing import Any, Generic, Optional, TypeVar
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from motor.motor_asyncio import AsyncIOMotorCollection
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)

T = TypeVar("T")


class BaseRepository(Generic[T]):
    def __init__(self, collection: AsyncIOMotorCollection, model_class: type) -> None:
        self._col = collection
        self._cls = model_class

    def _obj_id(self, id_str: str) -> ObjectId:
        try:
            return ObjectId(id_str)
        except (InvalidId, TypeError) as exc:
            raise ValueError(f"Invalid ObjectId: {id_str!r}") from exc

    def _doc_to_model(self, doc: dict) -> T:
        if doc is None:
            return None
        # Convert ObjectId _id to string
        converted = {**doc}
        if "_id" in converted:
            converted["_id"] = str(converted["_id"])
        return self._cls.model_validate(converted)

    async def find_by_id(self, id: str) -> Optional[T]:
        try:
            oid = self._obj_id(id)
        except ValueError:
            return None
        doc = await self._col.find_one({"_id": oid})
        return self._doc_to_model(doc) if doc else None

    async def find_all(
        self,
        filter_: dict,
        skip: int = 0,
        limit: int = 50,
        sort: list | None = None,
    ) -> tuple[list[T], int]:
        total = await self._col.count_documents(filter_)
        cursor = self._col.find(filter_).skip(skip).limit(limit)
        if sort:
            cursor = cursor.sort(sort)
        docs = await cursor.to_list(length=limit)
        items = [self._doc_to_model(doc) for doc in docs]
        return items, total

    async def create(self, doc: dict) -> T:
        result = await self._col.insert_one(doc)
        created_doc = await self._col.find_one({"_id": result.inserted_id})
        return self._doc_to_model(created_doc)

    async def update(self, id: str, fields: dict) -> Optional[T]:
        try:
            oid = self._obj_id(id)
        except ValueError:
            return None
        update_fields = {**fields, "updated_at": datetime.now(timezone.utc)}
        updated_doc = await self._col.find_one_and_update(
            {"_id": oid},
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_model(updated_doc) if updated_doc else None

    async def update_with_filter(
        self, id: str, extra_filter: dict, fields: dict
    ) -> Optional[T]:
        """Atomic conditional update — only applies if extra_filter conditions are also met.

        Returns the updated document, or None if the record was not found or
        the extra_filter conditions were not satisfied (race condition).
        """
        try:
            oid = self._obj_id(id)
        except ValueError:
            return None
        filter_ = {"_id": oid, **extra_filter}
        update_fields = {**fields, "updated_at": datetime.now(timezone.utc)}
        updated_doc = await self._col.find_one_and_update(
            filter_,
            {"$set": update_fields},
            return_document=ReturnDocument.AFTER,
        )
        return self._doc_to_model(updated_doc) if updated_doc else None

    async def delete(self, id: str) -> bool:
        try:
            oid = self._obj_id(id)
        except ValueError:
            return False
        result = await self._col.delete_one({"_id": oid})
        return result.deleted_count > 0

    async def count(self, filter_: dict | None = None) -> int:
        return await self._col.count_documents(filter_ or {})
