'use client';

import { Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useClient } from '@/hooks/use-clients';
import { useCan } from '@/hooks/use-can';
import { apiClient } from '@/services/api/api-client';

interface ClientSidePanelProps {
  clientId: string;
  onClose: () => void;
}

export function ClientSidePanel({ clientId, onClose }: ClientSidePanelProps) {
  const { data: clientWrapper, isLoading: isLoadingClient } = useClient(clientId);
  const queryClient = useQueryClient();
  const canUpdateClient = useCan('CLIENT_UPDATE');
  const canDeleteClient = useCan('CLIENT_DELETE');

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      await apiClient(`/clients/${clientId}`, { method: 'DELETE' });
      toast.success('Client deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      onClose();
    } catch (error) {
      toast.error('Failed to delete client');
    }
  };

  const client = clientWrapper?.client;

  if (isLoadingClient || !client) {
    return (
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl p-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded-md bg-slate-200" />
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4 text-slate-500" />
          </Button>
        </div>
        <div className="mt-8 flex flex-col items-center">
          <div className="h-16 w-16 animate-pulse rounded-full bg-slate-200" />
          <div className="mt-4 h-6 w-24 animate-pulse rounded-md bg-slate-200" />
        </div>
      </div>
    );
  }


  return (
    <div className="flex h-full w-full flex-col overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 bg-white/40 px-6 py-4 backdrop-blur-md">
        <h2 className="text-[15px] font-semibold text-slate-900">{client.name}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-slate-500 hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-6">
        {/* Profile Section */}
        <div className="flex flex-col items-center justify-center pb-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
            {client.name.substring(0, 2).toUpperCase()}
          </div>
          <div className="mt-4">
            <StatusBadge status={client.status} variant="ring" />
          </div>
        </div>

        {/* Client Information */}
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Client Information</h3>
            <div className="flex items-center gap-2">
              {canUpdateClient && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium"
                  onClick={() => (window.location.href = `/clients/${client.id}?tab=edit`)}
                >
                  <Pencil className="mr-1.5 h-3 w-3" /> Edit
                </Button>
              )}
              {canDeleteClient && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleDelete}
                >
                  <Trash2 className="mr-1.5 h-3 w-3" /> Delete
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium text-slate-400">Company Name</p>
              <p className="mt-0.5 text-[13px] font-medium text-slate-900">{client.name}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Email</p>
              {client.email ? (
                <a
                  href={`mailto:${client.email}`}
                  className="mt-0.5 block text-[13px] font-medium text-blue-600 hover:underline"
                >
                  {client.email}
                </a>
              ) : (
                <p className="mt-0.5 text-[13px] text-slate-500 italic">Not provided</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Phone</p>
              <p className="mt-0.5 text-[13px] font-medium text-slate-900">
                {client.phone || <span className="text-slate-500 italic">Not provided</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Industry</p>
              <p className="mt-0.5 text-[13px] font-medium text-slate-900">
                {client.industry || <span className="text-slate-500 italic">Not provided</span>}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Website</p>
              {client.website ? (
                <a
                  href={client.website}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 block text-[13px] font-medium text-blue-600 hover:underline"
                >
                  {client.website}
                </a>
              ) : (
                <p className="mt-0.5 text-[13px] text-slate-500 italic">Not provided</p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400">Address</p>
              <p className="mt-0.5 text-[13px] font-medium whitespace-pre-line text-slate-900">
                {client.address || <span className="text-slate-500 italic">Not provided</span>}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
