'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

import { DataTableToolbar } from '@/components/shared/data-table/data-table-toolbar';
import { EmptyState } from '@/components/shared/data-table/empty-state';
import { Pagination } from '@/components/shared/data-table/pagination';
import { SearchInput } from '@/components/shared/data-table/search-input';
import { SortDropdown } from '@/components/shared/data-table/sort-dropdown';
import { StatusFilter } from '@/components/shared/data-table/status-filter';
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
import { StatusBadge } from '@/components/ui/status-badge';
import { useCan } from '@/hooks/use-can';
import { useClients, useDeleteClient, useUpdateClient } from '@/hooks/use-clients';
import { cn, getStringColorGradient, getStringColorHover } from '@/lib/utils';

export interface ClientListProps {
  selectedClientId?: string | null;
  onSelectClient?: (id: string) => void;
}

export function ClientList({ selectedClientId, onSelectClient }: ClientListProps) {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  
  const limit = parseInt(searchParams.get('limit') || '6', 10);
  const search = searchParams.get('search') || undefined;
  const status = (searchParams.get('status') as any) || undefined;
  const sort = (searchParams.get('sort') as any) || 'createdAt';
  const order = (searchParams.get('order') as any) || 'desc';

  const { data, isLoading } = useClients({ page, limit, search, status, sort, order });
  const { mutateAsync: deleteClient, isPending: isDeleting } = useDeleteClient();
  const { mutateAsync: updateClient, isPending: isUpdating } = useUpdateClient();
  const canDeleteClient = useCan('CLIENT_DELETE');
  const canUpdateClient = useCan('CLIENT_UPDATE');

  const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDelete = async () => {
    if (!clientToDelete) return;
    try {
      await deleteClient(clientToDelete.id);
      toast.success('Client archived successfully');
      setClientToDelete(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to archive client');
    }
  };

  const clients = data?.data || [];
  const totalClients = data?.total || 0;
  const totalPages = data?.pages || 1;

  return (
    <div className="flex h-full flex-col">
      {/* Main Content Area */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl">
        {/* Toolbar */}
        <div className="border-b border-slate-200/60 bg-white/40 p-4">
          <DataTableToolbar>
            <SearchInput placeholder="Search clients..." />
            <StatusFilter
              paramName="status"
              options={[
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Archived', value: 'ARCHIVED' },
              ]}
            />
            <SortDropdown
              options={[
                { label: 'Recently Created', value: 'createdAt:desc' },
                { label: 'Oldest', value: 'createdAt:asc' },
                { label: 'Recently Updated', value: 'updatedAt:desc' },
                { label: 'Name (A-Z)', value: 'name:asc' },
                { label: 'Name (Z-A)', value: 'name:desc' },
              ]}
            />
          </DataTableToolbar>
        </div>

        {/* Table Area */}
        <div className="w-full overflow-x-auto overflow-y-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Projects</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Created On</th>
              </tr>
            </thead>
            <motion.tbody 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="divide-y divide-slate-100/80"
            >
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="bg-white">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-40" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-12" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </td>
                    <td className="px-6 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  </tr>
                ))
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="p-8">
                      <EmptyState
                        title="No clients found"
                        description={
                          search
                            ? 'Try adjusting your search or filters.'
                            : 'Get started by creating a new client.'
                        }
                      />
                    </div>
                  </td>
                </tr>
              ) : (
                  clients.map((client) => (
                    <motion.tr
                      variants={rowVariants}
                      key={client.id}
                      onClick={() => onSelectClient?.(client.id)}
                      data-selected={selectedClientId === client.id}
                      className={cn(
                        'group cursor-pointer transition-colors',
                        getStringColorHover(client.name)
                      )}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200/60 bg-gradient-to-br font-bold shadow-sm ring-1",
                            getStringColorGradient(client.name)
                          )}>
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span className="truncate font-bold tracking-tight text-slate-900">
                            {(client as any).code || client.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 w-[35%] max-w-0">
                        <div className="flex flex-col overflow-hidden">
                          <span className="truncate font-medium text-slate-900">{client.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {client.email ? (
                          <span className="font-medium text-slate-700">{client.email}</span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No email</span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {(client as any).projectsCount || 0}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={client.status} variant="ring" />
                      </td>
                      <td className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {new Date(client.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </motion.tr>
                  ))
              )}
            </motion.tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!isLoading && (
          <div className="border-t border-slate-200/60 bg-white/40">
            <Pagination totalPages={totalPages} totalItems={totalClients} />
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog
        open={!!clientToDelete}
        onOpenChange={(open) => !open && !isDeleting && setClientToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the client {clientToDelete?.name}. You can&apos;t undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
