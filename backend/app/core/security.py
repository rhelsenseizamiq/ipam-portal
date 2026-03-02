import uuid
import logging
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

_TOKEN_BLOCKLIST_COLLECTION = "token_blocklist"


def create_access_token(username: str, role: str, full_name: str, settings) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {
        "sub": username,
        "role": role,
        "full_name": full_name,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(username: str, settings) -> str:
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.JWT_REFRESH_EXPIRE_HOURS)
    payload = {
        "sub": username,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": expire,
        "type": "refresh",
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str, settings) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as exc:
        logger.warning("JWT decode error: %s", type(exc).__name__)
        raise credentials_exception from exc


async def add_to_blocklist(jti: str, exp: datetime, db) -> None:
    collection = db[_TOKEN_BLOCKLIST_COLLECTION]
    await collection.insert_one(
        {
            "jti": jti,
            "exp": exp,
            "blocked_at": datetime.now(timezone.utc),
        }
    )


async def is_blocklisted(jti: str, db) -> bool:
    collection = db[_TOKEN_BLOCKLIST_COLLECTION]
    doc = await collection.find_one({"jti": jti})
    return doc is not None
