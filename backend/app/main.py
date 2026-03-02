import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.core.database import close_mongo_connection, connect_to_mongo, get_database
from app.core.logging_config import configure_logging
from app.core.password import hash_password
from app.core.rate_limiter import limiter
from app.models.user import Role

logger = logging.getLogger(__name__)


async def _seed_default_admin() -> None:
    """Creates the default administrator account if it does not already exist."""
    settings = get_settings()
    db = get_database()
    now = datetime.now(timezone.utc)
    result = await db["users"].update_one(
        {"username": settings.INITIAL_ADMIN_USERNAME},
        {
            "$setOnInsert": {
                "username": settings.INITIAL_ADMIN_USERNAME,
                "password_hash": hash_password(settings.INITIAL_ADMIN_PASSWORD),
                "full_name": "System Administrator",
                "email": None,
                "role": Role.ADMINISTRATOR.value,
                "is_active": True,
                "created_at": now,
                "updated_at": now,
                "created_by": "system",
                "last_login": None,
            }
        },
        upsert=True,
    )
    if result.upserted_id:
        logger.info(
            "Default admin user '%s' created. Change the password immediately.",
            settings.INITIAL_ADMIN_USERNAME,
        )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    configure_logging()
    logger.info("Starting IPAM Portal API")
    await connect_to_mongo()
    await _seed_default_admin()
    yield
    logger.info("Shutting down IPAM Portal API")
    await close_mongo_connection()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="IPAM Portal API",
        version="1.0.0",
        description="IP Address Management Portal — REST API",
        docs_url="/api/docs" if settings.ENABLE_SWAGGER else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if settings.ENABLE_SWAGGER else None,
        lifespan=lifespan,
    )

    # Attach rate limiter state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Real-IP"],
    )

    # Include routers
    from app.routers import auth, users, ip_records, subnets, audit_logs

    api_prefix = "/api/v1"
    app.include_router(auth.router, prefix=api_prefix)
    app.include_router(users.router, prefix=api_prefix)
    app.include_router(ip_records.router, prefix=api_prefix)
    app.include_router(subnets.router, prefix=api_prefix)
    app.include_router(audit_logs.router, prefix=api_prefix)

    @app.get("/health", tags=["health"])
    async def health_check() -> dict:
        return {
            "status": "ok",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    return app


app = create_app()
