from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, Field

from app.models.asset import AssetType, AssetStatus


class AssetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    asset_type: AssetType
    status: AssetStatus = AssetStatus.ACTIVE
    ip_record_id: Optional[str] = None
    hostname: Optional[str] = Field(None, max_length=253)
    serial_number: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    os_version: Optional[str] = Field(None, max_length=100)
    data_center: Optional[str] = Field(None, max_length=100)
    rack_location: Optional[str] = Field(None, max_length=100)
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)
    tags: list[str] = Field(default_factory=list)


class AssetUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    asset_type: Optional[AssetType] = None
    status: Optional[AssetStatus] = None
    ip_record_id: Optional[str] = None
    hostname: Optional[str] = Field(None, max_length=253)
    serial_number: Optional[str] = Field(None, max_length=100)
    vendor: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    os_version: Optional[str] = Field(None, max_length=100)
    data_center: Optional[str] = Field(None, max_length=100)
    rack_location: Optional[str] = Field(None, max_length=100)
    warranty_expiry: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)
    tags: Optional[list[str]] = None


class AssetResponse(BaseModel):
    id: str
    name: str
    asset_type: AssetType
    status: AssetStatus
    ip_record_id: Optional[str]
    # Denormalised from linked ip_record (if any)
    ip_address: Optional[str] = None
    hostname: Optional[str]
    serial_number: Optional[str]
    vendor: Optional[str]
    model: Optional[str]
    os_version: Optional[str]
    data_center: Optional[str]
    rack_location: Optional[str]
    warranty_expiry: Optional[date]
    notes: Optional[str]
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: str
