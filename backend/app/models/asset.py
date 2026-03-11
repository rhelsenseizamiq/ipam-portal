from enum import Enum
from typing import Optional
from datetime import date, datetime, timezone
from pydantic import BaseModel, Field, ConfigDict


class AssetType(str, Enum):
    SERVER = "Server"
    SWITCH = "Switch"
    ROUTER = "Router"
    FIREWALL = "Firewall"
    LOAD_BALANCER = "Load Balancer"
    STORAGE = "Storage"
    VM = "Virtual Machine"
    OTHER = "Other"


class AssetStatus(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    MAINTENANCE = "Maintenance"
    DECOMMISSIONED = "Decommissioned"


class Asset(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[str] = Field(default=None, alias="_id")
    name: str
    asset_type: AssetType
    status: AssetStatus = AssetStatus.ACTIVE
    ip_record_id: Optional[str] = None
    hostname: Optional[str] = None
    serial_number: Optional[str] = None
    vendor: Optional[str] = None
    model: Optional[str] = None
    os_version: Optional[str] = None
    data_center: Optional[str] = None
    rack_location: Optional[str] = None
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = "system"
    updated_by: str = "system"
