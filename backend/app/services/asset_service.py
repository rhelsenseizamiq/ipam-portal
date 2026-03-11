import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException, status

from app.models.asset import Asset
from app.models.audit_log import AuditAction, ResourceType
from app.repositories.asset_repository import AssetRepository
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.ip_record_repository import IPRecordRepository
from app.schemas.asset import AssetCreate, AssetResponse, AssetUpdate

logger = logging.getLogger(__name__)


def _to_response(asset: Asset, ip_address: Optional[str] = None) -> AssetResponse:
    return AssetResponse(
        id=asset.id,
        name=asset.name,
        asset_type=asset.asset_type,
        status=asset.status,
        ip_record_id=asset.ip_record_id,
        ip_address=ip_address,
        hostname=asset.hostname,
        serial_number=asset.serial_number,
        vendor=asset.vendor,
        model=asset.model,
        os_version=asset.os_version,
        data_center=asset.data_center,
        rack_location=asset.rack_location,
        warranty_expiry=asset.warranty_expiry,
        notes=asset.notes,
        tags=asset.tags,
        created_at=asset.created_at,
        updated_at=asset.updated_at,
        created_by=asset.created_by,
        updated_by=asset.updated_by,
    )


def _asset_snapshot(asset: Asset) -> dict:
    return {
        "name": asset.name,
        "asset_type": asset.asset_type.value,
        "status": asset.status.value,
        "ip_record_id": asset.ip_record_id,
        "hostname": asset.hostname,
        "serial_number": asset.serial_number,
        "vendor": asset.vendor,
        "model": asset.model,
        "data_center": asset.data_center,
        "rack_location": asset.rack_location,
    }


class AssetService:
    def __init__(
        self,
        asset_repo: AssetRepository,
        ip_repo: IPRecordRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._assets = asset_repo
        self._ips = ip_repo
        self._audit = audit_repo

    async def _resolve_ip_address(self, ip_record_id: Optional[str]) -> Optional[str]:
        if not ip_record_id:
            return None
        record = await self._ips.find_by_id(ip_record_id)
        return record.ip_address if record else None

    async def list_assets(
        self,
        asset_type: Optional[str],
        status: Optional[str],
        data_center: Optional[str],
        search: Optional[str],
        skip: int,
        limit: int,
    ) -> tuple[list[AssetResponse], int]:
        assets, total = await self._assets.find_all_filtered(
            asset_type=asset_type,
            status=status,
            data_center=data_center,
            search=search,
            skip=skip,
            limit=limit,
        )
        items = []
        for asset in assets:
            ip_address = await self._resolve_ip_address(asset.ip_record_id)
            items.append(_to_response(asset, ip_address))
        return items, total

    async def get_by_id(self, asset_id: str) -> AssetResponse:
        asset = await self._assets.find_by_id(asset_id)
        if asset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset '{asset_id}' not found",
            )
        ip_address = await self._resolve_ip_address(asset.ip_record_id)
        return _to_response(asset, ip_address)

    async def create(
        self,
        data: AssetCreate,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> AssetResponse:
        if data.ip_record_id:
            ip_record = await self._ips.find_by_id(data.ip_record_id)
            if ip_record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"IP Record '{data.ip_record_id}' not found",
                )

        now = datetime.now(timezone.utc)
        doc = {
            **data.model_dump(),
            "warranty_expiry": data.warranty_expiry.isoformat() if data.warranty_expiry else None,
            "created_at": now,
            "updated_at": now,
            "created_by": username,
            "updated_by": username,
        }
        asset = await self._assets.create(doc)
        ip_address = await self._resolve_ip_address(asset.ip_record_id)

        await self._audit.log(
            action=AuditAction.CREATE,
            resource_type=ResourceType.ASSET,
            resource_id=asset.id,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            after=_asset_snapshot(asset),
        )

        return _to_response(asset, ip_address)

    async def update(
        self,
        asset_id: str,
        data: AssetUpdate,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> AssetResponse:
        existing = await self._assets.find_by_id(asset_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset '{asset_id}' not found",
            )

        if data.ip_record_id:
            ip_record = await self._ips.find_by_id(data.ip_record_id)
            if ip_record is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"IP Record '{data.ip_record_id}' not found",
                )

        fields = {k: v for k, v in data.model_dump().items() if v is not None}
        if "warranty_expiry" in fields and fields["warranty_expiry"] is not None:
            fields["warranty_expiry"] = fields["warranty_expiry"].isoformat()
        fields["updated_by"] = username

        updated = await self._assets.update(asset_id, fields)
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset '{asset_id}' not found",
            )

        ip_address = await self._resolve_ip_address(updated.ip_record_id)

        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.ASSET,
            resource_id=asset_id,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            before=_asset_snapshot(existing),
            after=_asset_snapshot(updated),
        )

        return _to_response(updated, ip_address)

    async def delete(
        self,
        asset_id: str,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> None:
        existing = await self._assets.find_by_id(asset_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Asset '{asset_id}' not found",
            )

        await self._assets.delete(asset_id)

        await self._audit.log(
            action=AuditAction.DELETE,
            resource_type=ResourceType.ASSET,
            resource_id=asset_id,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            before=_asset_snapshot(existing),
        )
