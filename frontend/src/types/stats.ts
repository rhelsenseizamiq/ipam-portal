export interface SubnetCritical {
  id: string;
  cidr: string;
  name: string;
  utilization_pct: number;
  alert_threshold: number | null;
}

export interface ActivityItem {
  timestamp: string;
  username: string;
  action: string;
  resource_type: string;
  summary: string;
}

export interface DashboardStats {
  total_ips: number;
  status_breakdown: Record<string, number>;
  os_breakdown: Record<string, number>;
  environment_breakdown: Record<string, number>;
  total_subnets: number;
  total_vrfs: number;
  total_aggregates: number;
  subnet_v4_count: number;
  subnet_v6_count: number;
  ip_v4_count: number;
  ip_v6_count: number;
  critical_subnets: SubnetCritical[];
  recent_activity: ActivityItem[];
}
