import apiClient from './client';
import type { AuditLog, AuditLogFilters } from '../types/auditLog';
import type { PaginatedResponse } from '../types/common';

export const auditLogsApi = {
  list: (filters: AuditLogFilters = {}) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/audit-logs', { params: filters }),

  get: (id: string) => apiClient.get<AuditLog>(`/audit-logs/${id}`),
};
