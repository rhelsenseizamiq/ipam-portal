import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase, AsyncIOMotorCollection
from app.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None


async def connect_to_mongo() -> None:
    global _client
    settings = get_settings()
    logger.info("Connecting to MongoDB at %s", settings.MONGODB_URI.split("@")[-1])
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    # Ping to verify connection
    await _client.admin.command("ping")
    logger.info("MongoDB connection established")


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    if _client is None:
        raise RuntimeError("MongoDB client is not initialized. Call connect_to_mongo() first.")
    settings = get_settings()
    return _client[settings.MONGODB_DB_NAME]


def get_collection(name: str) -> AsyncIOMotorCollection:
    db = get_database()
    return db[name]
