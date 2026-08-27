'use client';

import { AlertCircle, Calendar, CheckCircle2, Clock, Folder, Trash2, User, X } from 'lucide-react';

import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCan } from '@/hooks/use-can';
import { useProject } from '@/hooks/use-projects';
import { useTenantSLA } from '@/hooks/use-sla';
import { apiClient } from '@/services/api/api-client';

interface ProjectSidePanelProps {
  projectId: string;
  onClose: () => void;
}

export function ProjectSidePanel({ projectId, onClose }: ProjectSidePanelProps) {
  const { data: projectResponse, isLoading: isLoadingProject } = useProject(projectId);
  const { data: slaData, isLoading: isLoadingSla } = useTenantSLA();
  const slaPolicy = slaData?.policy;
  const canUpdateProject = useCan('PROJECT_UPDATE');
  const canDeleteProject = useCan('PROJECT_DELETE');
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    try {
      await apiClient(`/projects/${projectId}`, { method: 'DELETE' });
      toast.success('Project deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  if (isLoadingProject || isLoadingSla) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const project = projectResponse;
  if (!project) return null;

  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-sm backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-200/60 bg-white/40 px-6 py-5 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{project.name}</h2>
              <StatusBadge status={project.status} variant="ring" />
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-slate-200 px-6 pt-2">
          <TabsList className="h-10 w-full justify-start gap-6 rounded-none bg-transparent p-0">
            <TabsTrigger
              value="overview"
              className="relative h-10 rounded-none border-b-2 border-transparent bg-transparent px-0 pt-2 pb-3 text-sm font-medium text-slate-500 hover:text-slate-900 data-[state=active]:border-indigo-600 data-[state=active]:text-indigo-600 data-[state=active]:shadow-none"
            >
              Overview
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
          <TabsContent value="overview" className="m-0 space-y-6">
            {/* Project Information */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Project Information</h3>
                <div className="flex items-center gap-2">
                  {canUpdateProject && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => (window.location.href = `/projects/${project.id}/edit`)}
                    >
                      Edit
                    </Button>
                  )}
                  {canDeleteProject && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={handleDelete}
                    >
                      <Trash2 className="mr-1.5 h-3 w-3" /> Delete
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Client</p>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-xs font-medium text-purple-700">
                      {project.client?.name?.substring(0, 2).toUpperCase() || 'NA'}
                    </div>
                    <p className="text-[13px] font-medium text-slate-900">
                      {project.client?.name || 'Unknown'}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Priority</p>
                  <div className="mt-1">
                    <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-red-600/10 ring-inset">
                      {project.defaultPriority || 'Medium'}
                    </span>
                  </div>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] font-medium text-slate-400">Description</p>
                  <p className="mt-1 text-[13px] text-slate-600">
                    {project.description || 'No description provided.'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Created On</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-900">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-slate-400">Last Updated</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[13px] text-slate-900">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {new Date(project.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>



          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
