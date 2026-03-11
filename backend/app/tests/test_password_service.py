"""Unit tests for PasswordService — encrypt/decrypt, member access, REVEAL audit."""
import base64
import pytest
import pytest_asyncio
from datetime import datetime, timezone
from unittest.mock import patch

from fastapi import HTTPException

from app.repositories.cabinet_repository import CabinetRepository
from app.repositories.password_repository import PasswordRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.schemas.password_entry import PasswordEntryCreate, PasswordEntryUpdate
from app.services.password_service import PasswordService

MASTER_KEY = base64.b64encode(b"B" * 32).decode()


@pytest_asyncio.fixture()
async def cabinet_repo(mock_db):
    return CabinetRepository(mock_db["cabinets"])


@pytest_asyncio.fixture()
async def password_repo(mock_db):
    return PasswordRepository(mock_db["password_entries"])


@pytest_asyncio.fixture()
async def password_service(mock_db, cabinet_repo, password_repo, audit_repo):
    return PasswordService(
        password_repo=password_repo,
        cabinet_repo=cabinet_repo,
        audit_repo=audit_repo,
    )


@pytest_asyncio.fixture()
async def sample_cabinet(cabinet_repo):
    now = datetime.now(timezone.utc)
    return await cabinet_repo.create({
        "name": "Test Cabinet",
        "description": None,
        "member_usernames": ["alice", "operator1"],
        "created_at": now,
        "updated_at": now,
        "created_by": "admin",
        "updated_by": "admin",
    })


@pytest.mark.asyncio
async def test_create_entry_encrypts_password(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        entry = await password_service.create_entry(
            data=PasswordEntryCreate(
                cabinet_id=sample_cabinet.id,
                title="Test Entry",
                password="supersecret",
            ),
            created_by="alice",
            role="Operator",
            client_ip="127.0.0.1",
        )
    assert entry.id is not None
    # Response schema must NOT expose password/ciphertext
    assert not hasattr(entry, "ciphertext")
    assert not hasattr(entry, "iv")


@pytest.mark.asyncio
async def test_non_member_cannot_list(password_service, sample_cabinet):
    with pytest.raises(HTTPException) as exc:
        await password_service.list_entries(
            cabinet_id=sample_cabinet.id,
            username="outsider",
            role="Viewer",
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_member_can_list(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        await password_service.create_entry(
            data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="E1", password="pw1"),
            created_by="alice", role="Operator", client_ip="127.0.0.1",
        )
        entries, total = await password_service.list_entries(
            cabinet_id=sample_cabinet.id, username="alice", role="Operator"
        )
    assert total == 1
    assert entries[0].title == "E1"


@pytest.mark.asyncio
async def test_reveal_decrypts_password(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        entry = await password_service.create_entry(
            data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="DB Root", password="rootpw"),
            created_by="alice", role="Operator", client_ip="127.0.0.1",
        )
        reveal, headers = await password_service.reveal_entry(
            entry_id=entry.id, username="alice", role="Operator", client_ip="127.0.0.1"
        )
    assert reveal.password == "rootpw"
    assert headers.get("Cache-Control") == "no-store"


@pytest.mark.asyncio
async def test_reveal_non_member_forbidden(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        entry = await password_service.create_entry(
            data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="Secret", password="pw"),
            created_by="alice", role="Operator", client_ip="127.0.0.1",
        )
        with pytest.raises(HTTPException) as exc:
            await password_service.reveal_entry(
                entry_id=entry.id, username="hacker", role="Administrator", client_ip="127.0.0.1"
            )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_reveal_logs_audit(password_service, sample_cabinet, audit_repo):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        entry = await password_service.create_entry(
            data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="Audit Entry", password="pw"),
            created_by="alice", role="Operator", client_ip="127.0.0.1",
        )
        await password_service.reveal_entry(
            entry_id=entry.id, username="alice", role="Operator", client_ip="10.0.0.1"
        )
    logs, total = await audit_repo.find_all({"action": "REVEAL"})
    assert total >= 1
    assert any("Audit Entry" in (log.detail or "") for log in logs)


@pytest.mark.asyncio
async def test_update_entry_re_encrypts(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        entry = await password_service.create_entry(
            data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="Mutable", password="old_pw"),
            created_by="alice", role="Operator", client_ip="127.0.0.1",
        )
        await password_service.update_entry(
            entry_id=entry.id,
            data=PasswordEntryUpdate(password="new_pw"),
            updated_by="alice",
            role="Operator",
            client_ip="127.0.0.1",
        )
        reveal, _ = await password_service.reveal_entry(
            entry_id=entry.id, username="alice", role="Operator", client_ip="127.0.0.1"
        )
    assert reveal.password == "new_pw"


@pytest.mark.asyncio
async def test_viewer_cannot_create(password_service, sample_cabinet):
    with patch("app.services.password_service.get_settings") as mock_settings:
        mock_settings.return_value.VAULT_MASTER_KEY = MASTER_KEY
        with pytest.raises(HTTPException) as exc:
            await password_service.create_entry(
                data=PasswordEntryCreate(cabinet_id=sample_cabinet.id, title="T", password="p"),
                created_by="alice",
                role="Viewer",
                client_ip="127.0.0.1",
            )
    assert exc.value.status_code == 403
