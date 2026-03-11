import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from fastapi.responses import Response

from app.config import get_settings
from app.core.vault import decrypt_password, encrypt_password
from app.models.audit_log import AuditAction, ResourceType
from app.models.user import Role
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.cabinet_repository import CabinetRepository
from app.repositories.password_repository import PasswordRepository
from app.schemas.password_entry import (
    PasswordEntryCreate,
    PasswordEntryDetailResponse,
    PasswordEntryResponse,
    PasswordEntryUpdate,
    RevealResponse,
)

logger = logging.getLogger(__name__)


def _to_response(entry) -> PasswordEntryResponse:
    return PasswordEntryResponse(
        id=entry.id,
        cabinet_id=entry.cabinet_id,
        title=entry.title,
        username=entry.username,
        url=entry.url,
        tags=entry.tags,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        created_by=entry.created_by,
        updated_by=entry.updated_by,
    )


def _to_detail_response(entry) -> PasswordEntryDetailResponse:
    return PasswordEntryDetailResponse(
        id=entry.id,
        cabinet_id=entry.cabinet_id,
        title=entry.title,
        username=entry.username,
        url=entry.url,
        notes=entry.notes,
        tags=entry.tags,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        created_by=entry.created_by,
        updated_by=entry.updated_by,
    )


async def _assert_member(
    cabinet_repo: CabinetRepository,
    cabinet_id: str,
    username: str,
    role: str,
) -> None:
    """Raise 403 if the user is not a member of the cabinet.

    NOTE: Even Administrators must be explicit members to access password entries.
    Admin role only grants cabinet management (CRUD on cabinet objects).
    """
    cabinet = await cabinet_repo.find_by_id(cabinet_id)
    if cabinet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cabinet not found")
    if username not in cabinet.member_usernames:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this cabinet",
        )


def _require_vault_key() -> str:
    settings = get_settings()
    if not settings.VAULT_MASTER_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vault is not configured. Set VAULT_MASTER_KEY in environment.",
        )
    return settings.VAULT_MASTER_KEY


class PasswordService:
    def __init__(
        self,
        password_repo: PasswordRepository,
        cabinet_repo: CabinetRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._passwords = password_repo
        self._cabinets = cabinet_repo
        self._audit = audit_repo

    async def list_entries(
        self,
        cabinet_id: str,
        username: str,
        role: str,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[PasswordEntryResponse], int]:
        await _assert_member(self._cabinets, cabinet_id, username, role)
        entries, total = await self._passwords.find_by_cabinet(cabinet_id, skip=skip, limit=limit)
        return [_to_response(e) for e in entries], total

    async def get_entry(
        self,
        entry_id: str,
        username: str,
        role: str,
    ) -> PasswordEntryDetailResponse:
        entry = await self._passwords.find_by_id(entry_id)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        await _assert_member(self._cabinets, entry.cabinet_id, username, role)
        return _to_detail_response(entry)

    async def reveal_entry(
        self,
        entry_id: str,
        username: str,
        role: str,
        client_ip: str,
    ) -> tuple[RevealResponse, dict]:
        master_key = _require_vault_key()
        entry = await self._passwords.find_by_id(entry_id)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        await _assert_member(self._cabinets, entry.cabinet_id, username, role)

        try:
            plaintext = decrypt_password(master_key, entry.cabinet_id, entry.ciphertext, entry.iv)
        except Exception as exc:
            logger.error("Decryption failed for entry %s: %s", entry_id, exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to decrypt password. The vault key may have changed.",
            ) from exc

        await self._audit.log(
            action=AuditAction.REVEAL,
            resource_type=ResourceType.PASSWORD_ENTRY,
            username=username,
            user_role=role,
            client_ip=client_ip,
            resource_id=entry_id,
            detail=f"Revealed password for entry '{entry.title}' in cabinet '{entry.cabinet_id}'",
        )
        headers = {"Cache-Control": "no-store"}
        return RevealResponse(password=plaintext), headers

    async def create_entry(
        self,
        data: PasswordEntryCreate,
        created_by: str,
        role: str,
        client_ip: str,
    ) -> PasswordEntryResponse:
        if role not in (Role.OPERATOR.value, Role.ADMINISTRATOR.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operator or Administrator role required",
            )
        master_key = _require_vault_key()
        await _assert_member(self._cabinets, data.cabinet_id, created_by, role)

        ciphertext, iv = encrypt_password(master_key, data.cabinet_id, data.password)
        now = datetime.now(timezone.utc)
        doc = {
            "cabinet_id": data.cabinet_id,
            "title": data.title,
            "username": data.username,
            "ciphertext": ciphertext,
            "iv": iv,
            "url": data.url,
            "notes": data.notes,
            "tags": data.tags,
            "created_at": now,
            "updated_at": now,
            "created_by": created_by,
            "updated_by": created_by,
        }
        entry = await self._passwords.create(doc)
        await self._audit.log(
            action=AuditAction.CREATE,
            resource_type=ResourceType.PASSWORD_ENTRY,
            username=created_by,
            user_role=role,
            client_ip=client_ip,
            resource_id=entry.id,
            after={"title": entry.title, "cabinet_id": entry.cabinet_id},
            detail=f"Created password entry '{entry.title}'",
        )
        return _to_response(entry)

    async def update_entry(
        self,
        entry_id: str,
        data: PasswordEntryUpdate,
        updated_by: str,
        role: str,
        client_ip: str,
    ) -> PasswordEntryResponse:
        if role not in (Role.OPERATOR.value, Role.ADMINISTRATOR.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operator or Administrator role required",
            )
        entry = await self._passwords.find_by_id(entry_id)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        await _assert_member(self._cabinets, entry.cabinet_id, updated_by, role)

        fields = data.model_dump(exclude_none=True)
        if "password" in fields:
            master_key = _require_vault_key()
            ciphertext, iv = encrypt_password(master_key, entry.cabinet_id, fields.pop("password"))
            fields["ciphertext"] = ciphertext
            fields["iv"] = iv

        if not fields:
            return _to_response(entry)

        fields["updated_by"] = updated_by
        updated = await self._passwords.update(entry_id, fields)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.PASSWORD_ENTRY,
            username=updated_by,
            user_role=role,
            client_ip=client_ip,
            resource_id=entry_id,
            detail=f"Updated password entry '{entry.title}'",
        )
        return _to_response(updated)

    async def delete_entry(
        self,
        entry_id: str,
        deleted_by: str,
        role: str,
        client_ip: str,
    ) -> None:
        if role not in (Role.OPERATOR.value, Role.ADMINISTRATOR.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Operator or Administrator role required",
            )
        entry = await self._passwords.find_by_id(entry_id)
        if entry is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
        await _assert_member(self._cabinets, entry.cabinet_id, deleted_by, role)

        deleted = await self._passwords.delete(entry_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete entry",
            )
        await self._audit.log(
            action=AuditAction.DELETE,
            resource_type=ResourceType.PASSWORD_ENTRY,
            username=deleted_by,
            user_role=role,
            client_ip=client_ip,
            resource_id=entry_id,
            before={"title": entry.title, "cabinet_id": entry.cabinet_id},
            detail=f"Deleted password entry '{entry.title}'",
        )
