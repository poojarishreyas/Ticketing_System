'use client';

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { TicketStatus } from '@prisma/client';
import { format } from 'date-fns';
import { motion, Variants } from 'framer-motion';
import {
  AlertTriangle,
  ArrowDownUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MoreHorizontal,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useClients } from '@/hooks/use-clients';
import { useProjects } from '@/hooks/use-projects';
import { useTickets } from '@/hooks/use-tickets';
import { cn, getStringColorGradient, getStringColorHover } from '@/lib/utils';

import { AssignEngineerSidebar } from './assign-engineer-sidebar';
import { TicketDetails } from './ticket-details';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const getStatusLabel = (status: string) => {
  if (status === 'WAITING_ON_CLIENT') return 'WAITING FOR CLIENT';
  return status.replace(/_/g, ' ');
};

const getSlaStatus = (ticket: any) => {
  if (ticket.status === 'RESOLVED' || ticket.status === 'CLOSED') {
    return { label: 'On Track', color: 'text-emerald-500', icon: CheckCircle2 };
  }

  const now = new Date();
  if (ticket.sla?.resolutionBreachAt) {
    const breachAt = new Date(ticket.sla.resolutionBreachAt);
    if (now > breachAt) {
      return { label: 'Breached', color: 'text-red-500', icon: AlertTriangle };
    }
    const hoursLeft = (breachAt.getTime() - now.getTime()) / 3_600_000;
    if (hoursLeft < 4) {
      return { label: 'At Risk', color: 'text-amber-500', icon: Clock };
    }
  }
  return { label: 'On Track', color: 'text-emerald-500', icon: CheckCircle2 };
};

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Last updated' },
  { value: 'createdAt', label: 'Created date' },
  { value: 'number', label: 'Ticket number' },
  { value: 'title', label: 'Title' },
  { value: 'client', label: 'Client' },
  { value: 'project', label: 'Project' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
] as const;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
export function TicketList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '');
  const [selectedTicketToAssign, setSelectedTicketToAssign] = useState<any | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({
    projectId: searchParams.get('projectId') || 'all',
    clientId: searchParams.get('clientId') || 'all',
    status: searchParams.get('status') || 'all',
    priority: searchParams.get('priority') || 'all',
  });
  const [draftSort, setDraftSort] = useState(searchParams.get('sort') || 'updatedAt');
  const [draftOrder, setDraftOrder] = useState<'asc' | 'desc'>(
    searchParams.get('order') === 'asc' ? 'asc' : 'desc',
  );
  const { data: projectsResponse } = useProjects({
    page: 1,
    limit: 100,
    sort: 'name',
    order: 'asc',
  });
  const { data: clientsResponse } = useClients({
    page: 1,
    limit: 100,
    sort: 'name',
    order: 'asc',
  });

  // Derive current active tab from URL parameters
  const currentTab = (() => {
    if (searchParams.get('assignedToId') === user?.id) return 'My Tickets';
    if (searchParams.get('assignedToId') === 'unassigned') return 'Unassigned';
    if (searchParams.get('isOverdue') === 'true') return 'Overdue';
    if (searchParams.get('dueToday') === 'true') return 'Due Today';
    if (searchParams.get('status') === 'RESOLVED') return 'Resolved';
    if (searchParams.get('status') === 'CLOSED') return 'Closed';
    return 'All Tickets';
  })();

  const queryParams = new URLSearchParams(searchParams.toString());
  if (!queryParams.has('limit')) queryParams.set('limit', '6');
  const { data, isLoading } = useTickets(queryParams);

  const pathname = usePathname();

  // ---------------------------------------------------------------------------
  // Navigation Handlers
  // ---------------------------------------------------------------------------
  const updateQuery = (key: string, value: string | null, clearOthers = false) => {
    const params = new URLSearchParams(clearOthers ? '' : searchParams.toString());

    // If setting a tab, clear pagination
    if (key === 'page') {
      // keep
    } else {
      params.delete('page');
    }

    if (value === null || value === 'all') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setTab = (tabName: string) => {
    const params = new URLSearchParams();
    if (tabName === 'My Tickets' && user) params.set('assignedToId', user.id);
    if (tabName === 'Unassigned') params.set('assignedToId', 'unassigned');
    if (tabName === 'Overdue') params.set('isOverdue', 'true');
    if (tabName === 'Due Today') params.set('dueToday', 'true');
    if (tabName === 'Resolved') params.set('status', 'RESOLVED');
    if (tabName === 'Closed') params.set('status', 'CLOSED');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery('search', searchValue || null);
  };

  const openSortDialog = () => {
    setDraftSort(searchParams.get('sort') || 'updatedAt');
    setDraftOrder(searchParams.get('order') === 'asc' ? 'asc' : 'desc');
    setSortDialogOpen(true);
  };

  const openFiltersDialog = () => {
    setDraftFilters({
      projectId: searchParams.get('projectId') || 'all',
      clientId: searchParams.get('clientId') || 'all',
      status: searchParams.get('status') || 'all',
      priority: searchParams.get('priority') || 'all',
    });
    setFiltersDialogOpen(true);
  };

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(draftFilters).forEach(([key, value]) => {
      if (value === 'all') params.delete(key);
      else params.set(key, value);
    });
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setFiltersDialogOpen(false);
  };

  const applySort = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', draftSort);
    params.set('order', draftOrder);
    params.delete('page');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setSortDialogOpen(false);
  };

  const activeFilterCount = ['search', 'projectId', 'clientId', 'status', 'priority'].filter(
    (key) => searchParams.has(key),
  ).length;
  const activeSort = SORT_OPTIONS.find(
    (option) => option.value === (searchParams.get('sort') || 'updatedAt'),
  );
  const sortDirection = searchParams.get('order') === 'asc' ? 'Ascending' : 'Descending';
  const clearFiltersAndSort = () => {
    const params = new URLSearchParams(searchParams.toString());
    ['search', 'projectId', 'clientId', 'status', 'priority', 'sort', 'order', 'page'].forEach(
      (key) => params.delete(key),
    );
    setSearchValue('');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const TABS = [
    'All Tickets',
    'My Tickets',
    'Unassigned',
    'Overdue',
    'Due Today',
    'Resolved',
    'Closed',
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl">

      {/* 2. Filters Row */}
      <div className="flex flex-col gap-3 border-b border-slate-200/60 bg-white/40 px-6 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex w-full items-center lg:max-w-md"
        >
          <Search className="pointer-events-none absolute left-4 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, title, or keyword..."
            className="h-10 w-full rounded-full border border-slate-200/60 bg-white/60 pr-4 pl-10 text-sm text-slate-900 shadow-sm backdrop-blur transition-all placeholder:text-slate-400 hover:bg-white/80 focus:border-indigo-500/50 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:outline-none"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </form>

        <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={openFiltersDialog}
            className="h-10 rounded-full border-slate-200/60 bg-white/60 px-4 text-slate-700 shadow-sm backdrop-blur transition-all hover:bg-white/80"
          >
            <SlidersHorizontal className="mr-2 h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-100 px-1 text-[11px] font-bold text-indigo-700">
                {activeFilterCount}
              </span>
            )}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={openSortDialog}
            className="h-10 rounded-full border-slate-200/60 bg-white/60 px-4 text-slate-700 shadow-sm backdrop-blur transition-all hover:bg-white/80"
          >
            <ArrowDownUp className="mr-2 h-4 w-4" />
            {activeSort?.label ?? 'Sort'} · {sortDirection}
          </Button>
          {(activeFilterCount > 0 || searchParams.has('sort') || searchParams.has('order')) && (
            <Button
              type="button"
              variant="ghost"
              onClick={clearFiltersAndSort}
              className="h-10 rounded-full px-3 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <X className="mr-1.5 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* 3. Table */}
      <div className="flex-1 overflow-x-auto px-6 lg:px-8">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-200 bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="w-[40px] pl-0">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Ticket ID
              </TableHead>
              <TableHead className="min-w-[200px] text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Title
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Client
              </TableHead>
              <TableHead className="min-w-[150px] text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Raised By
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Project
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Priority
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Status
              </TableHead>
              <TableHead className="min-w-[180px] text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Engineer
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                SLA Status
              </TableHead>
              <TableHead className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                Created At
              </TableHead>
            </TableRow>
          </TableHeader>
          <motion.tbody
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="[&_tr:last-child]:border-0"
          >
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="h-48 text-center text-slate-500">
                  <RefreshCcw className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-500" />
                  Loading tickets...
                </TableCell>
              </TableRow>
            ) : !data || data.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="h-48 text-center text-slate-500">
                  No tickets found.
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((ticket: any) => {
                const sla = getSlaStatus(ticket);

                return (
                  <motion.tr
                    variants={rowVariants}
                    key={ticket.id}
                    tabIndex={0}
                    onClick={() => setSelectedTicketId(ticket.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedTicketId(ticket.id);
                      }
                    }}
                    className={cn(
                      'group cursor-pointer border-b border-slate-100/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-500',
                      getStringColorHover(ticket.client?.name || 'ticket'),
                    )}
                  >
                    <TableCell className="pl-0">
                      <input
                        type="checkbox"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded border-slate-300 text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 focus:ring-indigo-500"
                      />
                    </TableCell>

                    <TableCell className="font-medium text-indigo-600">
                      <span className="hover:underline">
                        TKT-{new Date(ticket.createdAt).getFullYear()}-
                        {ticket.number.toString().padStart(5, '0')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="line-clamp-2 pr-4 text-slate-700 group-hover:text-indigo-600">
                        {ticket.title}
                      </span>
                    </TableCell>

                    <TableCell className="text-slate-600">{ticket.client?.name}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border-0">
                          <AvatarFallback
                            className={cn(
                              'bg-gradient-to-br text-[10px] font-bold shadow-sm ring-1 ring-inset',
                              getStringColorGradient(ticket.reportedBy?.firstName || 'requester'),
                            )}
                          >
                            {ticket.reportedBy?.firstName?.[0] ?? '?'}
                            {ticket.reportedBy?.lastName?.[0] ?? ''}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {ticket.reportedBy
                              ? `${ticket.reportedBy.firstName} ${ticket.reportedBy.lastName}`
                              : 'Unknown requester'}
                          </p>
                          <p className="text-[11px] text-slate-500">Requester</p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-slate-600">{ticket.project?.name}</TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shadow-sm',
                            ticket.priority === 'URGENT'
                              ? 'bg-red-500 ring-1 shadow-red-500/50 ring-red-500/30'
                              : ticket.priority === 'HIGH'
                                ? 'bg-orange-500 ring-1 ring-orange-500/30'
                                : ticket.priority === 'MEDIUM'
                                  ? 'bg-blue-500 ring-1 ring-blue-500/30'
                                  : 'bg-slate-400 ring-1 ring-slate-400/30',
                          )}
                        />
                        <span className="tracking-wide text-slate-700 uppercase">
                          {ticket.priority}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shadow-sm',
                            ticket.status === 'OPEN' ||
                              ticket.status === 'IN_PROGRESS' ||
                              ticket.status === 'WAITING_ON_CLIENT'
                              ? 'bg-blue-500 ring-1 shadow-blue-500/50 ring-blue-500/30'
                              : ticket.status === 'RESOLVED' || ticket.status === 'CLOSED'
                                ? 'bg-emerald-500 ring-1 shadow-emerald-500/50 ring-emerald-500/30'
                                : 'bg-slate-400 ring-1 ring-slate-400/30',
                          )}
                        />
                        <span className="tracking-wide text-slate-700 uppercase">
                          {getStatusLabel(ticket.status)}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      {ticket.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7 border-0">
                            <AvatarImage src={ticket.assignedTo.avatarUrl || ''} />
                            <AvatarFallback
                              className={cn(
                                'bg-gradient-to-br text-[10px] font-bold shadow-sm ring-1 ring-inset',
                                getStringColorGradient(ticket.assignedTo.firstName),
                              )}
                            >
                              {ticket.assignedTo.firstName[0]}
                              {ticket.assignedTo.lastName[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="text-sm leading-tight font-medium text-slate-900">
                              {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                            </span>
                            <span className="text-[11px] leading-tight text-slate-500">
                              Engineer
                            </span>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedTicketToAssign(ticket);
                          }}
                          className="flex items-center gap-2 text-slate-400 transition-colors hover:text-indigo-600"
                        >
                          <span>—</span>
                          <span className="text-sm">Unassigned</span>
                        </button>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full shadow-sm',
                            sla.label === 'Breached'
                              ? 'bg-red-500 ring-1 shadow-red-500/50 ring-red-500/30'
                              : sla.label === 'Warning'
                                ? 'bg-amber-500 ring-1 shadow-amber-500/50 ring-amber-500/30'
                                : 'bg-emerald-500 ring-1 shadow-emerald-500/50 ring-emerald-500/30',
                          )}
                        />
                        <span className="tracking-wide text-slate-700 uppercase">{sla.label}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      <div>{format(new Date(ticket.createdAt), 'MMM d, yyyy')}</div>
                      <div className="text-[10px] text-slate-300">
                        {format(new Date(ticket.createdAt), 'hh:mm a')}
                      </div>
                    </TableCell>
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </Table>
      </div>

      {/* 4. Pagination Footer */}
      <div className="flex flex-col items-center justify-between border-t border-slate-200/60 bg-white/40 px-6 py-4 sm:flex-row lg:px-8">
        <div className="mb-4 text-sm text-slate-500 sm:mb-0">
          Showing{' '}
          {data?.totalItems === 0
            ? 0
            : ((data?.page || 1) - 1) * ((data as any)?.pageSize || 8) + 1}{' '}
          to {Math.min((data?.page || 1) * ((data as any)?.pageSize || 8), data?.totalItems || 0)}{' '}
          of {data?.totalItems || 0} tickets
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <select
              className="h-8 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700 shadow-sm outline-none"
              // @ts-ignore
              value={(data as any)?.pageSize || '6'}
              onChange={(e) => updateQuery('limit', e.target.value)}
            >
              <option value="6">6 per page</option>
              <option value="15">15 per page</option>
              <option value="25">25 per page</option>
              <option value="50">50 per page</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              className="h-8 w-8 rounded border-slate-200 p-0 shadow-sm"
              disabled={!data || data.page <= 1}
              onClick={() => updateQuery('page', String((data?.page || 1) - 1))}
            >
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </Button>

            {Array.from({ length: Math.min(3, data?.totalPages || 1) }, (_, i) => i + 1).map(
              (pageNum) => (
                <Button
                  key={pageNum}
                  variant={data?.page === pageNum ? 'default' : 'outline'}
                  className={`h-8 w-8 rounded p-0 shadow-sm ${
                    data?.page === pageNum
                      ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
                      : 'border-slate-200 text-slate-700'
                  }`}
                  onClick={() => updateQuery('page', String(pageNum))}
                >
                  {pageNum}
                </Button>
              ),
            )}

            {(data?.totalPages || 1) > 3 && (
              <>
                <div className="flex w-8 items-center justify-center text-slate-400">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
                <Button
                  variant="outline"
                  className="h-8 w-8 rounded border-slate-200 p-0 text-slate-700 shadow-sm"
                  onClick={() => updateQuery('page', String(data?.totalPages))}
                >
                  {data?.totalPages}
                </Button>
              </>
            )}

            <Button
              variant="outline"
              className="h-8 w-8 rounded border-slate-200 p-0 shadow-sm"
              disabled={!data || data.page >= data.totalPages}
              onClick={() => updateQuery('page', String((data?.page || 1) + 1))}
            >
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar Panel overlay for Assign Engineer */}
      <AssignEngineerSidebar
        ticket={selectedTicketToAssign}
        onClose={() => setSelectedTicketToAssign(null)}
      />

      <Dialog
        open={selectedTicketId !== null}
        onOpenChange={(open) => !open && setSelectedTicketId(null)}
      >
        <DialogContent className="h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto p-0 sm:max-w-6xl">
          <DialogTitle className="sr-only">Ticket details</DialogTitle>
          {selectedTicketId && <TicketDetails id={selectedTicketId} />}
        </DialogContent>
      </Dialog>

      <Dialog open={filtersDialogOpen} onOpenChange={setFiltersDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle>Filter tickets</DialogTitle>
            <DialogDescription>Refine the ticket list using one or more filters.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Project
              <select
                value={draftFilters.projectId}
                onChange={(event) =>
                  setDraftFilters((filters) => ({ ...filters, projectId: event.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">All projects</option>
                {(projectsResponse?.data ?? []).map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Client
              <select
                value={draftFilters.clientId}
                onChange={(event) =>
                  setDraftFilters((filters) => ({ ...filters, clientId: event.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">All clients</option>
                {(clientsResponse?.data ?? []).map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Status
              <select
                value={draftFilters.status}
                onChange={(event) =>
                  setDraftFilters((filters) => ({ ...filters, status: event.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">All statuses</option>
                {Object.keys(TicketStatus).map((status) => (
                  <option key={status} value={status}>
                    {getStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
              Priority
              <select
                value={draftFilters.priority}
                onChange={(event) =>
                  setDraftFilters((filters) => ({ ...filters, priority: event.target.value }))
                }
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 outline-none focus:border-indigo-500"
              >
                <option value="all">All priorities</option>
                {['URGENT', 'HIGH', 'MEDIUM', 'LOW'].map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none px-5">
            <Button type="button" variant="outline" onClick={() => setFiltersDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={applyFilters}
              className="bg-slate-900 hover:bg-slate-700"
            >
              Apply filters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={sortDialogOpen} onOpenChange={setSortDialogOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="px-5 pt-5 pb-4">
            <DialogTitle>Sort tickets</DialogTitle>
            <DialogDescription>Apply a consistent order across every page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 pb-5">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Sort by
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setDraftSort(option.value)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-left text-xs font-medium transition',
                      draftSort === option.value
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Direction
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(['asc', 'desc'] as const).map((direction) => (
                  <button
                    key={direction}
                    type="button"
                    onClick={() => setDraftOrder(direction)}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-xs font-medium transition',
                      draftOrder === direction
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50',
                    )}
                  >
                    {direction === 'asc' ? 'Ascending' : 'Descending'}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none px-5">
            <Button type="button" variant="outline" onClick={() => setSortDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applySort} className="bg-slate-900 hover:bg-slate-700">
              Apply sort
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
