from typing import Optional
from motor.motor_asyncio import AsyncIOMotorCollection

from app.models.user import User
from app.repositories.base import BaseRepository


class UserRepository(BaseRepository[User]):
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        super().__init__(collection, User)

    async def find_by_username(self, username: str) -> Optional[User]:
        doc = await self._col.find_one({"username": username})
        return self._doc_to_model(doc) if doc else None
