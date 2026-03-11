import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorCollection

from app.models.asset import Asset
from app.repositories.base import BaseRepository

logger = logging.getLogger(__name__)


class AssetRepository(BaseRepository[Asset]):
    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        super().__init__(collection, Asset)

    async def find_by_ip_record(self, ip_record_id: str) -> list[Asset]:
        cursor = self._col.find({"ip_record_id": ip_record_id})
        docs = await cursor.to_list(length=1000)
        return [self._doc_to_model(doc) for doc in docs]

    async def find_all_filtered(
        self,
        asset_type: Optional[str] = None,
        status: Optional[str] = None,
        data_center: Optional[str] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[Asset], int]:
        filter_: dict = {}

        if asset_type:
            filter_["asset_type"] = asset_type
        if status:
            filter_["status"] = status
        if data_center:
            filter_["data_center"] = data_center
        if search:
            filter_["$text"] = {"$search": search}

        return await self.find_all(
            filter_=filter_,
            skip=skip,
            limit=limit,
            sort=[("name", 1)],
        )
