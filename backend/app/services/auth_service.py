import logging
from datetime import datetime, timezone

from fastapi import HTTPException, Response, status

from app.core.password import verify_password, hash_password
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    add_to_blocklist,
    is_blocklisted,
)
from app.models.audit_log import AuditAction, ResourceType
from app.repositories.user_repository import UserRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

REFRESH_COOKIE_NAME = "ipam_refresh"


class AuthService:
    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._users = user_repo
        self._audit = audit_repo

    async def login(
        self,
        username: str,
        password: str,
        client_ip: str,
        settings,
        response: Response,
    ) -> TokenResponse:
        user = await self._users.find_by_username(username)

        if user is None or not user.is_active:
            await self._audit.log(
                action=AuditAction.LOGIN_FAILED,
                resource_type=ResourceType.AUTH,
                username=username,
                user_role="unknown",
                client_ip=client_ip,
                detail=f"Login failed: user not found or inactive for username '{username}'",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        if not verify_password(password, user.password_hash):
            await self._audit.log(
                action=AuditAction.LOGIN_FAILED,
                resource_type=ResourceType.AUTH,
                username=username,
                user_role=user.role.value,
                client_ip=client_ip,
                detail=f"Login failed: incorrect password for username '{username}'",
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        access_token = create_access_token(
            username=user.username,
            role=user.role.value,
            full_name=user.full_name,
            settings=settings,
        )
        refresh_token = create_refresh_token(username=user.username, settings=settings)

        # Update last_login timestamp
        await self._users.update(user.id, {"last_login": datetime.now(timezone.utc)})

        await self._audit.log(
            action=AuditAction.LOGIN,
            resource_type=ResourceType.AUTH,
            username=user.username,
            user_role=user.role.value,
            client_ip=client_ip,
            resource_id=user.id,
            detail="Successful login",
        )

        # Set HttpOnly refresh cookie
        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=refresh_token,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=settings.JWT_REFRESH_EXPIRE_HOURS * 3600,
            path="/api/v1/auth",
        )

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            role=user.role.value,
            full_name=user.full_name,
        )

    async def logout(
        self,
        jti: str,
        exp: datetime,
        db,
        username: str,
        user_role: str,
        client_ip: str,
        response: Response,
    ) -> None:
        await add_to_blocklist(jti=jti, exp=exp, db=db)
        await self._audit.log(
            action=AuditAction.LOGOUT,
            resource_type=ResourceType.AUTH,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            detail="User logged out",
        )
        response.delete_cookie(key=REFRESH_COOKIE_NAME, path="/api/v1/auth")

    async def refresh(
        self,
        refresh_token: str,
        settings,
        db,
        response: Response,
    ) -> TokenResponse:
        payload = decode_token(refresh_token, settings)

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type for refresh",
            )

        jti = payload.get("jti")
        username = payload.get("sub")

        if not jti or not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Malformed refresh token",
            )

        if await is_blocklisted(jti, db):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has been revoked",
            )

        user = await self._users.find_by_username(username)
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive",
            )

        # Rotate: blocklist old refresh token, issue new pair
        from datetime import timezone
        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        await add_to_blocklist(jti=jti, exp=exp_dt, db=db)

        new_access = create_access_token(
            username=user.username,
            role=user.role.value,
            full_name=user.full_name,
            settings=settings,
        )
        new_refresh = create_refresh_token(username=user.username, settings=settings)

        response.set_cookie(
            key=REFRESH_COOKIE_NAME,
            value=new_refresh,
            httponly=True,
            secure=True,
            samesite="lax",
            max_age=settings.JWT_REFRESH_EXPIRE_HOURS * 3600,
            path="/api/v1/auth",
        )

        return TokenResponse(
            access_token=new_access,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRE_MINUTES * 60,
            role=user.role.value,
            full_name=user.full_name,
        )

    async def change_password(
        self,
        username: str,
        current_password: str,
        new_password: str,
        client_ip: str,
        user_role: str,
    ) -> None:
        user = await self._users.find_by_username(username)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )

        if not verify_password(current_password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect",
            )

        new_hash = hash_password(new_password)
        await self._users.update(user.id, {"password_hash": new_hash})

        await self._audit.log(
            action=AuditAction.PASSWORD_RESET,
            resource_type=ResourceType.USER,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            resource_id=user.id,
            detail="User changed their own password",
        )
