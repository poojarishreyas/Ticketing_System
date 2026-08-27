'use client';

import { useState } from 'react';

import { cn, getStringColorGradient, getStringColorHover } from '@/lib/utils';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import {
  Building2,
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
import { StatusBadge } from '@/components/ui/status-badge';
import { useCan } from '@/hooks/use-can';
import { useArchiveProject, useProjects } from '@/hooks/use-projects';
import { CreateProjectDialog } from './create-project-dialog';
import { ProjectDashboardStats } from './project-dashboard-stats';

interface ProjectListProps {
  clientId?: string;
  selectedProjectId?: string | null;
  onSelectProject?: (id: string) => void;
}

export function ProjectList({
  clientId,
  selectedProjectId,
  onSelectProject,
}: ProjectListProps = {}) {
  const searchParams = useSearchParams();
  const page = parseInt(searchParams.get('page') || '1', 10);
  
  const limit = parseInt(searchParams.get('limit') || '6', 10);
  const search = searchParams.get('search') || undefined;
  const status = (searchParams.get('status') as any) || undefined;
  const supportStatus = (searchParams.get('supportStatus') as any) || undefined;
  const sort = (searchParams.get('sort') as any) || 'createdAt';
  const order = (searchParams.get('order') as any) || 'desc';

  const { data, isLoading } = useProjects({
    page,
    limit,
    search,
    status,
    supportStatus,
    sort,
    order,
    clientId,
  });
  const { mutateAsync: archiveProject, isPending: isArchiving } = useArchiveProject();

  const canCreateProject = useCan('PROJECT_CREATE');
  const canDeleteProject = useCan('PROJECT_DELETE');
  const canUpdateProject = useCan('PROJECT_UPDATE');

  const [projectToArchive, setProjectToArchive] = useState<{ id: string; name: string } | null>(
    null,
  );

  const confirmArchive = async () => {
    if (!projectToArchive) return;
    try {
      await archiveProject(projectToArchive.id);
      toast.success('Project archived successfully');
      setProjectToArchive(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Failed to archive project');
    }
  };

  const projects = data?.data || [];
  const totalProjects = data?.total || 0;
  const totalPages = data?.pages || 1;

  return (
    <div className="flex h-full flex-col">
      {/* Main Content Area */}
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl">
        {/* Toolbar */}
        <div className="border-b border-slate-200/60 bg-white/40 p-4">
          <DataTableToolbar>
            <SearchInput placeholder="Search projects by name, code or client..." />
            <StatusFilter
              paramName="status"
              options={[
                { label: 'Active', value: 'ACTIVE' },
                { label: 'Archived', value: 'ARCHIVED' },
              ]}
            />
            <StatusFilter
              paramName="supportStatus"
              placeholder="Support..."
              options={[
                { label: 'Enabled', value: 'ENABLED' },
                { label: 'Paused', value: 'PAUSED' },
              ]}
            />
            <SortDropdown
              options={[
                { label: 'Recently Created', value: 'createdAt:desc' },
                { label: 'Oldest', value: 'createdAt:asc' },
                { label: 'Recently Updated', value: 'updatedAt:desc' },
                { label: 'Name (A-Z)', value: 'name:asc' },
                { label: 'Client', value: 'client:asc' },
              ]}
            />
          </DataTableToolbar>
        </div>

        {/* Table Area */}
        <div className="w-full overflow-x-auto overflow-y-hidden">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            </div>
          ) : projects.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No projects found"
                description={
                  search
                    ? 'Try adjusting your search or filters.'
                    : 'Get started by creating a new project.'
                }
              />
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/40 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-4">Project</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Support Status</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Support Since</th>
                  <th className="px-6 py-4">Created On</th>
                </tr>
              </thead>
              <motion.tbody 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="divide-y divide-slate-100/80"
              >
                {projects.map((project) => {
                  const isSelected = selectedProjectId === project.id;
                  return (
                    <motion.tr
                      variants={rowVariants}
                      key={project.id}
                      onClick={() => onSelectProject?.(project.id)}
                      data-selected={selectedProjectId === project.id}
                      className={cn(
                        'group cursor-pointer transition-colors',
                        getStringColorHover(project.name)
                      )}
                    >
                      <td className="px-6 py-4 w-[35%] max-w-0">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border border-slate-200/60 bg-gradient-to-br shadow-sm ring-1",
                              getStringColorGradient(project.name)
                            )}
                          >
                            <Building2 className="h-5 w-5" />
                          </div>
                          <div className="flex flex-col overflow-hidden">
                            <span
                              className={`truncate font-medium ${isSelected ? 'text-indigo-900' : 'text-slate-900'}`}
                            >
                              {project.name}
                            </span>
                            <span className="truncate text-xs text-slate-500">
                              {project.description || project.code || 'No description'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                            {project.client?.name?.substring(0, 2).toUpperCase() || 'NA'}
                          </div>
                          <span className="font-medium text-slate-700">
                            {project.client?.name || 'Unknown'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-bold text-[11px]">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shadow-sm",
                              project.supportStatus === 'ENABLED'
                                ? 'bg-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/50'
                                : project.supportStatus === 'PAUSED'
                                  ? 'bg-amber-500 ring-1 ring-amber-500/30 shadow-amber-500/50'
                                  : 'bg-slate-400 ring-1 ring-slate-400/30'
                            )}
                          />
                          <span className="text-slate-700 uppercase tracking-wide">
                            {project.supportStatus === 'ENABLED'
                              ? 'Enabled'
                              : project.supportStatus === 'PAUSED'
                                ? 'Paused'
                                : 'Disabled'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={project.status} variant="ring" />
                      </td>
                      <td className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {project.supportStartDate
                          ? new Date(project.supportStartDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        {new Date(project.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!isLoading && (
          <div className="border-t border-slate-200/60 bg-white/40">
            <Pagination totalPages={totalPages} totalItems={totalProjects} />
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <AlertDialog
        open={!!projectToArchive}
        onOpenChange={(open) => !open && !isArchiving && setProjectToArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Project</AlertDialogTitle>
            <AlertDialogDescription>
              This will archive the project {projectToArchive?.name}. It will no longer be visible
              in the active projects list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              disabled={isArchiving}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {isArchiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
