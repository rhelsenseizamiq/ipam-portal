import ipaddress
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.audit_log import AuditAction, ResourceType
from app.models.ip_record import IPStatus
from app.models.subnet import Subnet
from app.repositories.audit_log_repository import AuditLogRepository
from app.repositories.ip_record_repository import IPRecordRepository
from app.repositories.subnet_repository import SubnetRepository
from app.schemas.subnet import SubnetCreate, SubnetDetailResponse, SubnetResponse, SubnetUpdate

logger = logging.getLogger(__name__)


def _to_response(subnet: Subnet) -> SubnetResponse:
    return SubnetResponse(
        id=subnet.id,
        cidr=subnet.cidr,
        name=subnet.name,
        description=subnet.description,
        gateway=subnet.gateway,
        vlan_id=subnet.vlan_id,
        environment=subnet.environment,
        created_at=subnet.created_at,
        updated_at=subnet.updated_at,
        created_by=subnet.created_by,
        updated_by=subnet.updated_by,
    )


def _subnet_snapshot(subnet: Subnet) -> dict:
    return {
        "cidr": subnet.cidr,
        "name": subnet.name,
        "description": subnet.description,
        "gateway": subnet.gateway,
        "vlan_id": subnet.vlan_id,
        "environment": subnet.environment.value,
    }


class SubnetService:
    def __init__(
        self,
        subnet_repo: SubnetRepository,
        ip_repo: IPRecordRepository,
        audit_repo: AuditLogRepository,
    ) -> None:
        self._subnets = subnet_repo
        self._ips = ip_repo
        self._audit = audit_repo

    async def create(
        self,
        data: SubnetCreate,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> SubnetResponse:
        # Validate CIDR
        try:
            network = ipaddress.ip_network(data.cidr, strict=False)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid CIDR: {data.cidr}",
            ) from exc

        # Validate gateway is within CIDR if provided
        if data.gateway is not None:
            gw = ipaddress.ip_address(data.gateway)
            if gw not in network:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Gateway {data.gateway} is not within subnet {data.cidr}",
                )

        # Validate no duplicate CIDR
        existing = await self._subnets.find_by_cidr(data.cidr)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Subnet with CIDR '{data.cidr}' already exists",
            )

        now = datetime.now(timezone.utc)
        doc = {
            "cidr": data.cidr,
            "name": data.name,
            "description": data.description,
            "gateway": data.gateway,
            "vlan_id": data.vlan_id,
            "environment": data.environment.value,
            "created_at": now,
            "updated_at": now,
            "created_by": username,
            "updated_by": username,
        }

        subnet = await self._subnets.create(doc)
        await self._audit.log(
            action=AuditAction.CREATE,
            resource_type=ResourceType.SUBNET,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            resource_id=subnet.id,
            after=_subnet_snapshot(subnet),
            detail=f"Created subnet {data.cidr}",
        )
        return _to_response(subnet)

    async def get_by_id(self, id: str) -> SubnetResponse:
        subnet = await self._subnets.find_by_id(id)
        if subnet is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subnet not found")
        return _to_response(subnet)

    async def list_subnets(
        self,
        filter_: dict,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SubnetDetailResponse], int]:
        subnets, total = await self._subnets.find_all(filter_, skip=skip, limit=limit)
        if not subnets:
            return [], total

        subnet_ids = [s.id for s in subnets if s.id]
        all_counts = await self._ips.count_by_status_for_subnets(subnet_ids)

        result: list[SubnetDetailResponse] = []
        for subnet in subnets:
            counts = all_counts.get(subnet.id, {})
            try:
                network = ipaddress.ip_network(subnet.cidr, strict=False)
                total_ips = network.num_addresses
            except ValueError:
                total_ips = 0

            result.append(SubnetDetailResponse(
                id=subnet.id,
                cidr=subnet.cidr,
                name=subnet.name,
                description=subnet.description,
                gateway=subnet.gateway,
                vlan_id=subnet.vlan_id,
                environment=subnet.environment,
                created_at=subnet.created_at,
                updated_at=subnet.updated_at,
                created_by=subnet.created_by,
                updated_by=subnet.updated_by,
                total_ips=total_ips,
                used_ips=counts.get(IPStatus.IN_USE.value, 0),
                free_ips=counts.get(IPStatus.FREE.value, 0),
                reserved_ips=counts.get(IPStatus.RESERVED.value, 0),
            ))
        return result, total

    async def update(
        self,
        id: str,
        data: SubnetUpdate,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> SubnetResponse:
        existing = await self._subnets.find_by_id(id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subnet not found")

        # Validate gateway is within CIDR if being updated
        if data.gateway is not None:
            try:
                network = ipaddress.ip_network(existing.cidr, strict=False)
                gw = ipaddress.ip_address(data.gateway)
                if gw not in network:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail=f"Gateway {data.gateway} is not within subnet {existing.cidr}",
                    )
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid gateway address: {data.gateway}",
                ) from exc

        before_snapshot = _subnet_snapshot(existing)
        update_fields = data.model_dump(exclude_none=True)
        if "environment" in update_fields and hasattr(update_fields["environment"], "value"):
            update_fields["environment"] = update_fields["environment"].value

        update_fields["updated_by"] = username

        if not update_fields:
            return _to_response(existing)

        updated = await self._subnets.update(id, update_fields)
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subnet not found")

        await self._audit.log(
            action=AuditAction.UPDATE,
            resource_type=ResourceType.SUBNET,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            resource_id=id,
            before=before_snapshot,
            after=_subnet_snapshot(updated),
            detail=f"Updated subnet {existing.cidr}",
        )
        return _to_response(updated)

    async def delete(
        self,
        id: str,
        username: str,
        user_role: str,
        client_ip: str,
    ) -> None:
        existing = await self._subnets.find_by_id(id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subnet not found")

        # Guard: cannot delete subnet that has IP records
        ip_count = await self._ips.count({"subnet_id": id})
        if ip_count > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot delete subnet '{existing.cidr}' — it has {ip_count} IP record(s) assigned",
            )

        before_snapshot = _subnet_snapshot(existing)
        deleted = await self._subnets.delete(id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete subnet",
            )

        await self._audit.log(
            action=AuditAction.DELETE,
            resource_type=ResourceType.SUBNET,
            username=username,
            user_role=user_role,
            client_ip=client_ip,
            resource_id=id,
            before=before_snapshot,
            detail=f"Deleted subnet {existing.cidr}",
        )

    async def get_detail(self, id: str) -> SubnetDetailResponse:
        subnet = await self._subnets.find_by_id(id)
        if subnet is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subnet not found")

        counts = await self._ips.count_by_subnet_and_status(id)

        try:
            network = ipaddress.ip_network(subnet.cidr, strict=False)
            total_ips = network.num_addresses
        except ValueError:
            total_ips = 0

        free_ips = counts.get("Free", 0)
        reserved_ips = counts.get("Reserved", 0)
        used_ips = counts.get("In Use", 0)

        return SubnetDetailResponse(
            id=subnet.id,
            cidr=subnet.cidr,
            name=subnet.name,
            description=subnet.description,
            gateway=subnet.gateway,
            vlan_id=subnet.vlan_id,
            environment=subnet.environment,
            created_at=subnet.created_at,
            updated_at=subnet.updated_at,
            created_by=subnet.created_by,
            updated_by=subnet.updated_by,
            total_ips=total_ips,
            used_ips=used_ips,
            free_ips=free_ips,
            reserved_ips=reserved_ips,
        )
