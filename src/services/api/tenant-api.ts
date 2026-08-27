import { Tenant, TenantStatus, User } from '@prisma/client';

import { CreateTenantInput, ListTenantQuery, UpdateTenantInput } from '@/lib/tenant/tenant.schema';

import { apiClient } from './api-client';

/** Pagination shape returned by the tenants list endpoint. */
export interface TenantPagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const tenantApi = {
  getTenants: async (params: ListTenantQuery, token: string) => {
    // Filter out undefined values before building query string
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined),
    );
    const query = new URLSearchParams(cleanParams as Record<string, string>).toString();
    return apiClient<{ data: Tenant[]; pagination: TenantPagination }>(
      `/platform/tenants?${query}`,
      { token },
    );
  },

  getTenant: async (id: string, token: string) => {
    return apiClient<{ data: Tenant }>(`/platform/tenants/${id}`, { token });
  },

  createTenant: async (data: CreateTenantInput, token: string) => {
    return apiClient<{ data: Tenant }>('/platform/tenants', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    });
  },

  updateTenant: async (id: string, data: UpdateTenantInput, token: string) => {
    return apiClient<{ data: Tenant }>(`/platform/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      token,
    });
  },

  updateTenantStatus: async (id: string, status: TenantStatus, token: string) => {
    return apiClient<{ data: Tenant }>(`/platform/tenants/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      token,
    });
  },

  deleteTenant: async (id: string, token: string) => {
    return apiClient<{ data: Tenant }>(`/platform/tenants/${id}`, {
      method: 'DELETE',
      token,
    });
  },

  getTenantStats: async (token: string) => {
    return apiClient<{ data: { total: number; active: number; suspended: number } }>(
      '/platform/tenants/stats',
      { token },
    );
  },

  getTenantUsers: async (tenantId: string, role: string, token: string) => {
    const query = new URLSearchParams({ role }).toString();
    return apiClient<{ data: Omit<User, 'password'>[] }>(
      `/platform/tenants/${tenantId}/users?${query}`,
      { token },
    );
  },
};
