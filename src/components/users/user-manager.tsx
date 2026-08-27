'use client';

import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { CreateUserDialog } from './create-user-dialog';
import { UserList } from './user-list';
import { UserSidePanel } from './user-side-panel';

export function UserManager() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: 'spring' as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col p-8"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="mb-8 flex flex-col items-start justify-between sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Users</h1>
          <p className="text-sm text-slate-500">Manage your organization&apos;s users and roles.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <CreateUserDialog
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          />
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={`grid gap-6 transition-all duration-300 ease-in-out ${
          selectedUserId ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'
        }`}
      >
        <div className="flex flex-col">
          <UserList selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />
        </div>
        {selectedUserId && (
          <div className="flex flex-col">
            <UserSidePanel userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
