import type { Environment } from './ipRecord';

export interface Subnet {
  id: string;
  cidr: string;
  name: string;
  description: string | null;
  gateway: string | null;
  vlan_id: number | null;
  environment: Environment;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export interface SubnetDetail extends Subnet {
  total_ips: number;
  used_ips: number;
  free_ips: number;
  reserved_ips: number;
}

export interface SubnetCreate {
  cidr: string;
  name: string;
  description?: string;
  gateway?: string;
  vlan_id?: number;
  environment: Environment;
}

export interface SubnetUpdate {
  name?: string;
  description?: string;
  gateway?: string;
  vlan_id?: number;
  environment?: Environment;
}
