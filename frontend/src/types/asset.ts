export type AssetType =
  | 'Server'
  | 'Switch'
  | 'Router'
  | 'Firewall'
  | 'Load Balancer'
  | 'Storage'
  | 'Virtual Machine'
  | 'Other';

export type AssetStatus = 'Active' | 'Inactive' | 'Maintenance' | 'Decommissioned';

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  status: AssetStatus;
  ip_record_id: string | null;
  ip_address: string | null;
  hostname: string | null;
  serial_number: string | null;
  vendor: string | null;
  model: string | null;
  os_version: string | null;
  data_center: string | null;
  rack_location: string | null;
  warranty_expiry: string | null; // ISO date string
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface AssetCreate {
  name: string;
  asset_type: AssetType;
  status?: AssetStatus;
  ip_record_id?: string | null;
  hostname?: string | null;
  serial_number?: string | null;
  vendor?: string | null;
  model?: string | null;
  os_version?: string | null;
  data_center?: string | null;
  rack_location?: string | null;
  warranty_expiry?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface AssetUpdate {
  name?: string;
  asset_type?: AssetType;
  status?: AssetStatus;
  ip_record_id?: string | null;
  hostname?: string | null;
  serial_number?: string | null;
  vendor?: string | null;
  model?: string | null;
  os_version?: string | null;
  data_center?: string | null;
  rack_location?: string | null;
  warranty_expiry?: string | null;
  notes?: string | null;
  tags?: string[];
}

export interface AssetFilters {
  page?: number;
  page_size?: number;
  asset_type?: AssetType;
  status?: AssetStatus;
  data_center?: string;
  search?: string;
}

export const ASSET_TYPES: AssetType[] = [
  'Server',
  'Switch',
  'Router',
  'Firewall',
  'Load Balancer',
  'Storage',
  'Virtual Machine',
  'Other',
];

export const ASSET_STATUSES: AssetStatus[] = [
  'Active',
  'Inactive',
  'Maintenance',
  'Decommissioned',
];
