'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

import { useCan } from '@/hooks/use-can';
import { ClientList } from './client-list';
import { ClientSidePanel } from './client-side-panel';
import { OnboardClientWizard } from './onboard-client-wizard';

export function ClientManager() {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const canCreateClient = useCan('CLIENT_CREATE');

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Client Management</h1>
          <p className="text-sm text-slate-500">
            Manage all client organizations associated with your tenant.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          {canCreateClient && <OnboardClientWizard />}
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className={`grid gap-6 transition-all duration-300 ease-in-out ${
          selectedClientId ? 'grid-cols-[minmax(0,1fr)_400px]' : 'grid-cols-1'
        }`}
      >
        <div className="flex flex-col">
          <ClientList selectedClientId={selectedClientId} onSelectClient={setSelectedClientId} />
        </div>
        {selectedClientId && (
          <div className="flex flex-col">
            <ClientSidePanel clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
