import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.core.password import hash_password
from app.models.audit_log import AuditAction, ResourceType
from app.models.user import Role, User
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.schemas.registration import RegisterRequest, ApproveRequest, RejectRequest

logger = logging.getLogger(__name__)


def _to_response(user: User) -> UserResponse:
    """Convert a User model to a UserResponse, explicitly excluding password_hash."""
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        approval_status=getattr(user, "approval_status", "approved"),
        registration_note=getattr(user, "registration_note", None),
        created_at=user.created_at,
        updated_at=user.updated_at,
        created_by=user.created_by,
        last_login=user.last_login,
    )


class UserService:
    def __init__(
        self,
        user_repo: UserRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._users = user_repo
        self._audit = audit_repo

    async def create(
        self,
        data: UserCreate,
        created_by: str,
        client_ip: str,
    ) -> UserResponse:
        existing = await self._users.find_by_username(data.username)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{data.username}' is already taken",
            )

        now = datetime.now(timezone.utc)
        doc = {
            "username": data.username,
            "password_hash": hash_password(data.password),
            "full_name": data.full_name,
            "email": data.email,
            "role": data.role.value,
            "is_active": True,
            "created_at": now,
            "updated_at": now,
            "created_by": created_by,
            "last_login": None,
        }

        created_user = await self._users.create(doc)
        after_snapshot = {
            "username": created_user.username,
            "full_name": created_user.full_name,
            "email": created_user.email,
            "role": created_user.role.value,
            "is_active": created_user.is_active,
        }
        await self._audit.log(
            action=AuditAction.CREATE,
            resource_type=ResourceType.USER,
            username=created_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=created_user.id,
            after=after_snapshot,
            detail=f"Created user '{data.username}'",
        )
        return _to_response(created_user)

    async def get_by_id(self, id: str) -> UserResponse:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return _to_response(user)

    async def list_users(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[UserResponse], int]:
        users, total = await self._users.find_all({}, skip=skip, limit=limit)
        return [_to_response(u) for u in users], total

    async def update(
        self,
        id: str,
        data: UserUpdate,
        updated_by: str,
        client_ip: str,
    ) -> UserResponse:
        existing = await self._users.find_by_id(id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        before_snapshot = {
            "full_name": existing.full_name,
            "email": existing.email,
            "role": existing.role.value,
        }

        update_fields = data.model_dump(exclude_none=True)
        if "role" in update_fields and isinstance(update_fields["role"], Role):
            update_fields["role"] = update_fields["role"].value

        if not update_fields:
            return _to_response(existing)

        updated_user = await self._users.update(id, update_fields)
        if updated_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        after_snapshot = {
            "full_name": updated_user.full_name,
            "email": updated_user.email,
            "role": updated_user.role.value,
        }
        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.USER,
            username=updated_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            before=before_snapshot,
            after=after_snapshot,
            detail=f"Updated user '{existing.username}'",
        )
        return _to_response(updated_user)

    async def reset_password(
        self,
        id: str,
        new_password: str,
        reset_by: str,
        client_ip: str,
    ) -> None:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        new_hash = hash_password(new_password)
        await self._users.update(id, {"password_hash": new_hash})

        await self._audit.log(
            action=AuditAction.PASSWORD_RESET,
            resource_type=ResourceType.USER,
            username=reset_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            detail=f"Password reset for user '{user.username}' by administrator '{reset_by}'",
        )

    async def delete(
        self,
        id: str,
        deleted_by: str,
        client_ip: str,
    ) -> None:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user.username == deleted_by:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account",
            )

        # Guard: deleting an Administrator must not leave zero active admins
        if user.role == Role.ADMINISTRATOR and user.is_active:
            active_admins_count = await self._users.count(
                {"role": Role.ADMINISTRATOR.value, "is_active": True}
            )
            if active_admins_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot delete the last active administrator",
                )

        before_snapshot = {
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.value,
            "is_active": user.is_active,
        }
        deleted = await self._users.delete(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete user",
            )

        await self._audit.log(
            action=AuditAction.DELETE,
            resource_type=ResourceType.USER,
            username=deleted_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            before=before_snapshot,
            detail=f"Permanently deleted user '{user.username}'",
        )

    async def register(
        self,
        data: RegisterRequest,
        client_ip: str,
    ) -> UserResponse:
        existing = await self._users.find_by_username(data.username)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Username '{data.username}' is already taken",
            )

        now = datetime.now(timezone.utc)
        doc = {
            "username": data.username,
            "password_hash": hash_password(data.password),
            "full_name": data.full_name,
            "email": data.email,
            "role": Role.VIEWER.value,
            "is_active": False,
            "approval_status": "pending",
            "registration_note": data.note,
            "rejection_reason": None,
            "auth_type": "local",
            "created_at": now,
            "updated_at": now,
            "created_by": "self-registration",
            "last_login": None,
        }

        created_user = await self._users.create(doc)
        await self._audit.log(
            action=AuditAction.REGISTER,
            resource_type=ResourceType.USER,
            username=data.username,
            user_role="anonymous",
            client_ip=client_ip,
            resource_id=created_user.id,
            detail=f"Self-registration submitted for username '{data.username}'",
        )
        return _to_response(created_user)

    async def list_pending(
        self,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[UserResponse], int]:
        users, total = await self._users.find_all(
            {"approval_status": "pending"}, skip=skip, limit=limit
        )
        return [_to_response(u) for u in users], total

    async def approve(
        self,
        id: str,
        data: ApproveRequest,
        approved_by: str,
        client_ip: str,
    ) -> UserResponse:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if getattr(user, "approval_status", "approved") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not in pending status",
            )

        update_fields = {
            "approval_status": "approved",
            "is_active": True,
            "role": data.role.value,
            "updated_at": datetime.now(timezone.utc),
        }
        updated_user = await self._users.update(id, update_fields)
        if updated_user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if data.cabinet_ids:
            from app.repositories.cabinet_repository import CabinetRepository
            from app.core.database import get_database
            db = get_database()
            cabinet_repo = CabinetRepository(db["cabinets"])
            for cabinet_id in data.cabinet_ids:
                await cabinet_repo.add_member(cabinet_id, user.username)

        await self._audit.log(
            action=AuditAction.APPROVE,
            resource_type=ResourceType.USER,
            username=approved_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            after={"role": data.role.value, "cabinet_ids": data.cabinet_ids},
            detail=f"Approved registration for user '{user.username}' with role {data.role.value}",
        )
        return _to_response(updated_user)

    async def reject(
        self,
        id: str,
        data: RejectRequest,
        rejected_by: str,
        client_ip: str,
    ) -> None:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if getattr(user, "approval_status", "approved") != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is not in pending status",
            )

        await self._users.update(id, {
            "approval_status": "rejected",
            "rejection_reason": data.reason,
            "updated_at": datetime.now(timezone.utc),
        })

        await self._audit.log(
            action=AuditAction.REJECT,
            resource_type=ResourceType.USER,
            username=rejected_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            detail=f"Rejected registration for user '{user.username}'",
        )

    async def deactivate(
        self,
        id: str,
        deactivated_by: str,
        client_ip: str,
    ) -> UserResponse:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already inactive",
            )

        # Guard: cannot deactivate the last active administrator
        if user.role == Role.ADMINISTRATOR:
            active_admins_count = await self._users.count(
                {"role": Role.ADMINISTRATOR.value, "is_active": True}
            )
            if active_admins_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active administrator",
                )

        updated_user = await self._users.update(id, {"is_active": False})
        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.USER,
            username=deactivated_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            before={"is_active": True},
            after={"is_active": False},
            detail=f"Deactivated user '{user.username}'",
        )
        return _to_response(updated_user)

    async def activate(
        self,
        id: str,
        activated_by: str,
        client_ip: str,
    ) -> UserResponse:
        user = await self._users.find_by_id(id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        if user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already active",
            )

        updated_user = await self._users.update(id, {"is_active": True})
        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.USER,
            username=activated_by,
            user_role="Administrator",
            client_ip=client_ip,
            resource_id=id,
            before={"is_active": False},
            after={"is_active": True},
            detail=f"Activated user '{user.username}'",
        )
        return _to_response(updated_user)
