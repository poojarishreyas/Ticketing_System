import { Suspense } from 'react';
import { Metadata } from 'next';

import { TicketList } from '@/components/tickets/ticket-list';
import { ExportTicketsButton } from '@/components/tickets/export-tickets-button';

export const metadata: Metadata = {
  title: 'Tickets | Elipdesk',
  description: 'Manage support tickets',
};

export default function TicketsPage() {
  return (
    <div className="flex h-full w-full flex-col bg-white">
      {/* Header */}
      <div className="flex flex-col items-start justify-between border-b border-transparent px-6 py-6 sm:flex-row sm:items-center lg:px-8">
        <div>
          <h1 className="mb-1 text-2xl font-bold tracking-tight text-slate-900">Tickets</h1>
          <p className="text-sm text-slate-500">View and manage tickets assigned to you.</p>
        </div>

        <div className="mt-4 flex items-center gap-3 sm:mt-0">
          <ExportTicketsButton />
        </div>
      </div>

      <div className="flex w-full flex-1 flex-col">
        <Suspense
          fallback={<div className="p-8 text-center text-slate-500">Loading tickets...</div>}
        >
          <TicketList />
        </Suspense>
      </div>
    </div>
  );
}
