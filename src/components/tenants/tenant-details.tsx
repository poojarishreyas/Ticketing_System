'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { Tenant, TenantStatus, User } from '@prisma/client';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { useAuth } from '@/hooks/use-auth';
import { tenantApi } from '@/services/api/tenant-api';
import { UpdateTenantInput, UpdateTenantSchema } from '@/lib/tenant/tenant.schema';

export function TenantDetails({ id }: { id: string }) {
  const { accessToken } = useAuth();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantAdmins, setTenantAdmins] = useState<Omit<User, 'password'>[]>([]);
  const [loading, setLoading] = useState(true);

  // Navigation & Dirty State
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // Danger Zone Actions
  const [confirmStatusChange, setConfirmStatusChange] = useState<TenantStatus | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isModifyingStatus, setIsModifyingStatus] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateTenantInput>({
    resolver: zodResolver(UpdateTenantSchema),
  });

  const fetchTenant = async () => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const [res, usersRes] = await Promise.all([
        tenantApi.getTenant(id, accessToken),
        tenantApi.getTenantUsers(id, 'TENANT_ADMIN', accessToken).catch(() => ({ data: [] })),
      ]);
      setTenant(res.data);
      setTenantAdmins(usersRes.data || []);
      reset({
        name: res.data.name,
        domain: res.data.domain,
        contactEmail: res.data.contactEmail,
        contactPhone: res.data.contactPhone,
        timezone: res.data.timezone,
        currency: res.data.currency,
      });
    } catch (_err: unknown) {
      toast.error('Failed to load tenant details');
      router.push('/platform/tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchTenant(), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, accessToken]);

  const handleNavigation = (path: string) => {
    if (isDirty) {
      setPendingNavigation(path);
      setShowUnsavedDialog(true);
    } else {
      router.push(path);
    }
  };

  const handleDiscardChanges = () => {
    reset();
    setShowUnsavedDialog(false);
    if (pendingNavigation) {
      router.push(pendingNavigation);
    }
  };

  const onSubmit = async (data: UpdateTenantInput) => {
    try {
      await tenantApi.updateTenant(id, data, accessToken!);
      toast.success('Tenant updated successfully');
      setTenant((prev) => (prev ? { ...prev, ...data } : prev));
      reset(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update tenant');
    }
  };

  const executeStatusChange = async () => {
    if (!confirmStatusChange) return;
    try {
      setIsModifyingStatus(true);
      await tenantApi.updateTenantStatus(id, confirmStatusChange, accessToken!);
      toast.success(`Tenant marked as ${confirmStatusChange}`);
      setConfirmStatusChange(null);
      fetchTenant(); // Refresh to get the new status
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to update status');
    } finally {
      setIsModifyingStatus(false);
    }
  };

  const executeDelete = async () => {
    try {
      setIsModifyingStatus(true);
      await tenantApi.deleteTenant(id, accessToken!);
      toast.success('Tenant deleted successfully');
      router.push('/platform/tenants');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete tenant');
      setIsModifyingStatus(false);
      setConfirmDelete(false);
    }
  };

  if (loading || !tenant) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  const createdDate = new Date(tenant.createdAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-32">
      {/* Breadcrumbs & Header */}
      <div className="space-y-4">
        <nav className="flex items-center text-sm font-medium text-slate-500">
          <button
            onClick={() => handleNavigation('/platform')}
            className="transition-colors hover:text-slate-900"
          >
            Platform
          </button>
          <ChevronRight className="mx-2 h-4 w-4" />
          <button
            onClick={() => handleNavigation('/platform/tenants')}
            className="transition-colors hover:text-slate-900"
          >
            Tenants
          </button>
          <ChevronRight className="mx-2 h-4 w-4" />
          <span className="text-slate-900">{tenant.name}</span>
        </nav>

        <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{tenant.name}</h1>
            <StatusBadge status={tenant.status} variant="emoji" className="px-3 py-1" />
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <p>
              Slug: <span className="font-mono text-slate-700">{tenant.slug}</span>
            </p>
            <span className="h-4 w-px bg-slate-300" />
            <p>
              Created <span className="text-slate-700">{createdDate}</span>
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* General Section */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h2 className="text-lg font-semibold text-slate-900">General</h2>
            <p className="text-sm text-slate-500">Basic information about the tenant.</p>
          </div>
          <div className="p-8">
            <div className="grid max-w-2xl gap-6">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Company Name</Label>
                <Input {...register('name')} className="bg-white" />
                {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Custom Domain</Label>
                <Input
                  {...register('domain')}
                  className="bg-white"
                  placeholder="company.example.com"
                />
                {errors.domain && (
                  <p className="mt-1 text-xs text-red-500">{errors.domain.message}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700">Timezone</Label>
                  <Input {...register('timezone')} className="bg-white" />
                </div>
                <div className="space-y-2">
                  <Label className="font-semibold text-slate-700">Currency</Label>
                  <Input {...register('currency')} className="bg-white" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
            <p className="text-sm text-slate-500">Primary points of contact for this tenant.</p>
          </div>
          <div className="p-8">
            <div className="grid max-w-2xl gap-6">
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Email Address</Label>
                <Input type="email" {...register('contactEmail')} className="bg-white" />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-slate-700">Phone Number</Label>
                <Input {...register('contactPhone')} className="bg-white" />
              </div>
            </div>
          </div>
        </section>

        {/* Tenant Administrators */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Tenant Administrators</h2>
            <p className="text-sm text-slate-500">Users who have administrative access to this tenant.</p>
          </div>
          <div className="p-0">
            {tenantAdmins.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No administrators found for this tenant.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-8 py-4">Name</th>
                    <th className="px-8 py-4">Email</th>
                    <th className="px-8 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="px-8 py-4 font-medium text-slate-900">
                        {admin.firstName} {admin.lastName}
                      </td>
                      <td className="px-8 py-4 text-slate-600">{admin.email}</td>
                      <td className="px-8 py-4">
                        <StatusBadge status={admin.status as any} variant="ring" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
          <div className="border-b border-red-100 bg-red-50/50 px-8 py-5">
            <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
            <p className="text-sm text-red-600/80">Destructive actions for this tenant.</p>
          </div>
          <div className="p-8">
            <div className="max-w-2xl rounded-xl border border-red-200 bg-red-50/30">
              {tenant.status === 'ACTIVE' ? (
                <div className="flex items-center justify-between p-6">
                  <div>
                    <h3 className="font-semibold text-slate-900">Suspend Tenant</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Temporarily block all access to this tenant&apos;s workspace.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                    onClick={() => setConfirmStatusChange('SUSPENDED')}
                  >
                    Suspend
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-6">
                  <div>
                    <h3 className="font-semibold text-slate-900">Reactivate Tenant</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Restore full access to this tenant&apos;s workspace.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                    onClick={() => setConfirmStatusChange('ACTIVE')}
                  >
                    Reactivate
                  </Button>
                </div>
              )}
              <div className="border-t border-red-200" />
              <div className="flex items-center justify-between p-6">
                <div>
                  <h3 className="font-semibold text-slate-900">Delete Tenant</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Permanently delete this tenant and all associated data.
                  </p>
                </div>
                <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  Delete Tenant
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Context-Aware Sticky Save Bar */}
        {isDirty && (
          <div className="animate-in slide-in-from-bottom-4 fixed right-0 bottom-0 left-0 z-50 flex items-center justify-between border-t border-slate-200 bg-white/80 p-4 px-8 shadow-[0_-4px_12px_-4px_rgba(0,0,0,0.1)] backdrop-blur-md transition-all">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
              <p className="font-medium text-amber-600">You have unsaved changes.</p>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowUnsavedDialog(true)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="min-w-[140px] bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Unsaved Changes Dialog */}
      <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to discard your changes? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowUnsavedDialog(false)}>
              Continue Editing
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDiscardChanges}
              className="bg-red-600 hover:bg-red-700"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Status Change Dialog */}
      <AlertDialog
        open={!!confirmStatusChange}
        onOpenChange={(open) => !open && !isModifyingStatus && setConfirmStatusChange(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmStatusChange === 'SUSPENDED'
                ? `Are you sure you want to suspend ${tenant.name}? Users will lose access immediately.`
                : `Are you sure you want to reactivate ${tenant.name}?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isModifyingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={executeStatusChange} disabled={isModifyingStatus}>
              {isModifyingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm Delete Dialog */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={(open) => !open && !isModifyingStatus && setConfirmDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tenant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete {tenant.name}? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isModifyingStatus}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={isModifyingStatus}
              className="bg-red-600 hover:bg-red-700"
            >
              {isModifyingStatus && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
