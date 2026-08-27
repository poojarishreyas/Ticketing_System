'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { useCan } from '@/hooks/use-can';

import { CreateProjectDialog } from './create-project-dialog';
import { ProjectList } from './project-list';
import { ProjectSidePanel } from './project-side-panel';

export function ProjectManager() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const canCreateProject = useCan('PROJECT_CREATE');

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col p-8"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8 flex flex-col items-start justify-between sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Project Management</h1>
          <p className="text-sm text-slate-500">
            Manage all projects and their support configurations.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {canCreateProject && <CreateProjectDialog />}
        </div>
      </motion.div>

      {/* Main Grid */}
      <motion.div
        variants={itemVariants}
        className={`grid gap-6 transition-all duration-300 ease-in-out ${
          selectedProjectId ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'
        }`}
      >
        {/* Left Pane - List */}
        <div className="flex flex-col">
          <ProjectList
            selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProjectId}
          />
        </div>

        {/* Right Pane - Detail */}
        {selectedProjectId && (
          <div className="flex flex-col">
            <ProjectSidePanel
              projectId={selectedProjectId}
              onClose={() => setSelectedProjectId(null)}
            />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
