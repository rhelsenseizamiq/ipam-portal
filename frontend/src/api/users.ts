import apiClient from './client';
import type { User, UserCreate, UserUpdate } from '../types/user';
import type { PaginatedResponse } from '../types/common';

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
}

export interface ResetPasswordPayload {
  new_password: string;
}

export const usersApi = {
  list: (params: UserListParams = {}) =>
    apiClient.get<PaginatedResponse<User>>('/users', { params }),

  get: (id: string) => apiClient.get<User>(`/users/${id}`),

  create: (data: UserCreate) => apiClient.post<User>('/users', data),

  update: (id: string, data: UserUpdate) => apiClient.put<User>(`/users/${id}`, data),

  delete: (id: string) => apiClient.delete<void>(`/users/${id}`),

  resetPassword: (id: string, payload: ResetPasswordPayload) =>
    apiClient.post<void>(`/users/${id}/reset-password`, payload),

  activate: (id: string) => apiClient.post<User>(`/users/${id}/activate`),

  deactivate: (id: string) => apiClient.post<User>(`/users/${id}/deactivate`),

  pending: (params: UserListParams = {}) =>
    apiClient.get<PaginatedResponse<User>>('/users/pending', { params }),

  approve: (id: string, data: { role: string; cabinet_ids: string[] }) =>
    apiClient.post<User>(`/users/${id}/approve`, data),

  reject: (id: string, data: { reason?: string }) =>
    apiClient.post<void>(`/users/${id}/reject`, data),
};
