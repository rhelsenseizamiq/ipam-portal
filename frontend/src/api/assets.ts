import apiClient from './client';
import type { Asset, AssetCreate, AssetUpdate, AssetFilters } from '../types/asset';
import type { PaginatedResponse } from '../types/common';

export const assetsApi = {
  list: (filters: AssetFilters = {}) =>
    apiClient.get<PaginatedResponse<Asset>>('/assets', { params: filters }),

  get: (id: string) => apiClient.get<Asset>(`/assets/${id}`),

  create: (data: AssetCreate) => apiClient.post<Asset>('/assets', data),

  update: (id: string, data: AssetUpdate) =>
    apiClient.put<Asset>(`/assets/${id}`, data),

  delete: (id: string) => apiClient.delete<void>(`/assets/${id}`),
};
