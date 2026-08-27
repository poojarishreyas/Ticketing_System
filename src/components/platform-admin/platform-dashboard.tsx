'use client';

import { useState } from 'react';
import Link from 'next/link';

import { TenantStatus } from '@prisma/client';
import {
  ArrowDownRight,
  ArrowUpDown,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
  MoreVertical,
  PauseCircle,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { CreateTenantDialog } from '@/components/tenants/create-tenant-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import {
  useDeleteTenant,
  useTenants,
  useTenantStats,
  useUpdateTenantStatus,
} from '@/hooks/use-tenants';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getStatusBadge(status: string) {
  if (status === 'ACTIVE') {
    return 'bg-green-100 text-green-700';
  }
  if (status === 'SUSPENDED') {
    return 'bg-red-100 text-red-700';
  }
  if (status === 'PENDING_ACTIVATION') {
    return 'bg-orange-100 text-orange-700';
  }
  return 'bg-slate-100 text-slate-700';
}

function getStatusDot(status: string) {
  if (status === 'ACTIVE') {
    return 'bg-green-500';
  }
  if (status === 'SUSPENDED') {
    return 'bg-red-500';
  }
  if (status === 'PENDING_ACTIVATION') {
    return 'bg-orange-500';
  }
  return 'bg-slate-500';
}

function getTenantIconColor(name: string) {
  const colors = [
    { text: 'text-blue-600', bg: 'bg-blue-50' },
    { text: 'text-emerald-600', bg: 'bg-emerald-50' },
    { text: 'text-purple-600', bg: 'bg-purple-50' },
    { text: 'text-orange-500', bg: 'bg-orange-50' },
    { text: 'text-rose-600', bg: 'bg-rose-50' },
  ];
  // Simple hash to consistently assign a color based on the tenant name
  const index = name.length % colors.length;
  return colors[index];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function PlatformDashboard() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State for List API initialized from URL
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get('limit')) || 10);
  const [statusFilter, setStatusFilter] = useState<TenantStatus | undefined>(
    (searchParams.get('status') as TenantStatus) || undefined
  );
  const [sort, setSort] = useState<'createdAt' | 'name' | 'status'>(
    (searchParams.get('sort') as 'createdAt' | 'name' | 'status') || 'createdAt'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('order') as 'asc' | 'desc') || 'desc'
  );
  
  const [tenantToUpdate, setTenantToUpdate] = useState<{
    id: string;
    name: string;
    status: TenantStatus;
  } | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<{ id: string; name: string } | null>(null);
  const deleteTenant = useDeleteTenant(accessToken ?? '');
  const updateTenantStatus = useUpdateTenantStatus(accessToken ?? '');

  const updateUrl = (updates: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, String(value));
      else params.delete(key);
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // Fetch Stats
  const { data: statsResponse, isLoading: isStatsLoading } = useTenantStats(accessToken ?? '');
  const stats = statsResponse?.data;

  // Fetch List
  const { data: listResponse, isLoading: isListLoading } = useTenants(
    {
      page,
      pageSize,
      search: search || undefined,
      status: statusFilter,
      sort,
      sortOrder,
    },
    accessToken ?? '',
  );

  const tenants = listResponse?.data ?? [];
  const pagination = listResponse?.pagination;
  const isModifying = deleteTenant.isPending || updateTenantStatus.isPending;

  const confirmStatusChange = async () => {
    if (!tenantToUpdate) return;

    const status = tenantToUpdate.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await updateTenantStatus.mutateAsync({ id: tenantToUpdate.id, status });
      toast.success(`${tenantToUpdate.name} ${status === 'ACTIVE' ? 'activated' : 'suspended'}`);
      setTenantToUpdate(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tenant status');
    }
  };

  const confirmDelete = async () => {
    if (!tenantToDelete) return;

    try {
      await deleteTenant.mutateAsync(tenantToDelete.id);
      toast.success(`${tenantToDelete.name} deleted successfully`);
      setTenantToDelete(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tenant');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* 1. Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Total Tenants */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Total Tenants</p>
              {isStatsLoading ? (
                <Skeleton className="mt-1 h-9 w-16" />
              ) : (
                <h3 className="mt-1 text-3xl font-bold text-slate-900">{stats?.total ?? 0}</h3>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUpRight className="mr-1 h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-emerald-500">All Time</span>
            <span className="ml-2 text-slate-500">organizations registered</span>
          </div>
        </div>

        {/* Active Tenants */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Active Tenants</p>
              {isStatsLoading ? (
                <Skeleton className="mt-1 h-9 w-16" />
              ) : (
                <h3 className="mt-1 text-3xl font-bold text-slate-900">{stats?.active ?? 0}</h3>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowUpRight className="mr-1 h-4 w-4 text-emerald-500" />
            <span className="font-semibold text-emerald-500">Live</span>
            <span className="ml-2 text-slate-500">in production</span>
          </div>
        </div>

        {/* Suspended Tenants */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-500">
              <PauseCircle className="h-7 w-7" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Suspended Tenants</p>
              {isStatsLoading ? (
                <Skeleton className="mt-1 h-9 w-16" />
              ) : (
                <h3 className="mt-1 text-3xl font-bold text-slate-900">{stats?.suspended ?? 0}</h3>
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
            <span className="font-semibold text-red-500">Action Required</span>
            <span className="ml-2 text-slate-500">review accounts</span>
          </div>
        </div>
      </div>

      {/* 2. Main Tenants Table Section */}
      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header Row */}
        <div className="flex flex-col items-start justify-between border-b border-slate-100 p-6 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Tenants</h2>
            <p className="text-sm text-slate-500">List of all tenant organizations</p>
          </div>

          <div className="mt-4 flex w-full flex-col items-center gap-3 sm:flex-row lg:mt-0 lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search tenants..."
                className="h-10 rounded-lg border-slate-200 pl-9 text-sm focus:border-blue-500 focus:ring-blue-500"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to page 1 on search
                  updateUrl({ search: e.target.value, page: 1 });
                }}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 sm:w-auto">
                <Filter className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700">
                  {statusFilter ? statusFilter : 'All Statuses'}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter(undefined);
                    setPage(1);
                    updateUrl({ status: undefined, page: 1 });
                  }}
                >
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter('ACTIVE');
                    setPage(1);
                    updateUrl({ status: 'ACTIVE', page: 1 });
                  }}
                >
                  Active
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter('SUSPENDED');
                    setPage(1);
                    updateUrl({ status: 'SUSPENDED', page: 1 });
                  }}
                >
                  Suspended
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setStatusFilter('PENDING_ACTIVATION');
                    setPage(1);
                    updateUrl({ status: 'PENDING_ACTIVATION', page: 1 });
                  }}
                >
                  Pending Activation
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100 sm:w-auto">
                <ArrowUpDown className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-700">Sort</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onClick={() => {
                    setSort('createdAt');
                    setSortOrder('desc');
                    setPage(1);
                    updateUrl({ sort: 'createdAt', order: 'desc', page: 1 });
                  }}
                >
                  Newest first
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSort('createdAt');
                    setSortOrder('asc');
                    setPage(1);
                    updateUrl({ sort: 'createdAt', order: 'asc', page: 1 });
                  }}
                >
                  Oldest first
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSort('name');
                    setSortOrder('asc');
                    setPage(1);
                    updateUrl({ sort: 'name', order: 'asc', page: 1 });
                  }}
                >
                  Name: A to Z
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSort('name');
                    setSortOrder('desc');
                    setPage(1);
                    updateUrl({ sort: 'name', order: 'desc', page: 1 });
                  }}
                >
                  Name: Z to A
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setSort('status');
                    setSortOrder('asc');
                    setPage(1);
                    updateUrl({ sort: 'status', order: 'asc', page: 1 });
                  }}
                >
                  Status: A to Z
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <CreateTenantDialog />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-left text-sm text-slate-600">
            <thead className="border-b border-slate-100 bg-white text-xs font-semibold text-slate-900">
              <tr>
                <th className="px-6 py-4">Tenant</th>
                <th className="px-6 py-4">Domain</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created At</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isListLoading ? (
                // Skeletons
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="flex flex-col gap-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                // Empty State
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    No tenants found matching your criteria.
                  </td>
                </tr>
              ) : (
                // Data Rows
                tenants.map((tenant) => {
                  const iconColors = getTenantIconColor(tenant.name);
                  return (
                    <tr key={tenant.id} className="bg-white transition-colors hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                              iconColors.bg,
                              iconColors.text,
                            )}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">{tenant.name}</span>
                            <span className="text-xs text-slate-500">{tenant.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {tenant.domain || <span className="text-slate-400 italic">None</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold',
                            getStatusBadge(tenant.status),
                          )}
                        >
                          <span
                            className={cn('h-1.5 w-1.5 rounded-full', getStatusDot(tenant.status))}
                          />
                          {tenant.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-600">
                        {new Date(tenant.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none">
                            <span className="sr-only">Open tenant actions</span>
                            <MoreVertical className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuGroup>
                              <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
                                Actions
                              </DropdownMenuLabel>
                              <DropdownMenuItem
                                className="cursor-pointer hover:bg-slate-100"
                                render={
                                  <Link
                                    href={`/platform/tenants/${tenant.id}`}
                                    className="flex w-full items-center gap-2"
                                  />
                                }
                              >
                                <Eye className="h-4 w-4 text-slate-400" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer hover:bg-slate-100"
                                render={
                                  <Link
                                    href={`/platform/tenants/${tenant.id}?tab=edit`}
                                    className="flex w-full items-center gap-2"
                                  />
                                }
                              >
                                <Pencil className="h-4 w-4 text-slate-400" /> Edit Tenant
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className={cn(
                                'flex cursor-pointer items-center gap-2',
                                tenant.status === 'ACTIVE'
                                  ? 'text-amber-600 hover:bg-amber-50 hover:text-amber-700 focus:text-amber-700'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 focus:text-emerald-700',
                              )}
                              onClick={() =>
                                setTenantToUpdate({
                                  id: tenant.id,
                                  name: tenant.name,
                                  status: tenant.status,
                                })
                              }
                            >
                              <ShieldAlert className="h-4 w-4" />
                              {tenant.status === 'ACTIVE' ? 'Suspend Tenant' : 'Activate Tenant'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="flex cursor-pointer items-center gap-2 text-red-600 hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700"
                              onClick={() =>
                                setTenantToDelete({ id: tenant.id, name: tenant.name })
                              }
                            >
                              <Trash2 className="h-4 w-4" /> Delete Tenant
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 p-4 sm:px-6">
          <p className="text-sm font-medium text-slate-500">
            {pagination ? (
              <>
                Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{' '}
                {pagination.total} tenants
              </>
            ) : (
              'Loading...'
            )}
          </p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-400 disabled:opacity-50"
                disabled={!pagination || pagination.page === 1}
                onClick={() => {
                  const newPage = Math.max(1, page - 1);
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 rounded-lg border-blue-600 bg-white p-0 text-blue-600"
              >
                {page}
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                disabled={
                  !pagination ||
                  pagination.page === pagination.totalPages ||
                  pagination.totalPages === 0
                }
                onClick={() => {
                  const newPage = page + 1;
                  setPage(newPage);
                  updateUrl({ page: newPage });
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="ml-4 flex items-center">
              <select
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-medium text-slate-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setPage(1);
                  updateUrl({ limit: newSize, page: 1 });
                }}
              >
                <option value="5">5 / page</option>
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        open={!!tenantToUpdate}
        onOpenChange={(open) => !open && !isModifying && setTenantToUpdate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tenantToUpdate?.status === 'ACTIVE' ? 'Suspend tenant?' : 'Activate tenant?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {tenantToUpdate?.status === 'ACTIVE'
                ? `${tenantToUpdate.name} users will lose access immediately.`
                : `${tenantToUpdate?.name} users will regain access immediately.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isModifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange} disabled={isModifying}>
              {isModifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!tenantToDelete}
        onOpenChange={(open) => !open && !isModifying && setTenantToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete tenant?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete {tenantToDelete?.name}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isModifying}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isModifying}
              className="bg-red-600 hover:bg-red-700"
            >
              {isModifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
