export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'RESERVE'
  | 'RELEASE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_RESET';

export type ResourceType = 'ip_record' | 'subnet' | 'user' | 'auth';

export interface AuditLog {
  id: string;
  action: AuditAction;
  resource_type: ResourceType;
  resource_id: string | null;
  username: string;
  user_role: string;
  client_ip: string;
  timestamp: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  detail: string | null;
}

export interface AuditLogFilters {
  username?: string;
  action?: AuditAction;
  resource_type?: ResourceType;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}
