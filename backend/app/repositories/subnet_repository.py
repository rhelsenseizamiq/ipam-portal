from typing import Optional
from motor.motor_asyncio import AsyncIOMotorCollection

from app.models.subnet import Subnet
from app.repositories.base import BaseRepository


class SubnetRepository(BaseRepository[Subnet]):
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        super().__init__(collection, Subnet)

    async def find_by_cidr(self, cidr: str) -> Optional[Subnet]:
        doc = await self._col.find_one({"cidr": cidr})
        return self._doc_to_model(doc) if doc else None
