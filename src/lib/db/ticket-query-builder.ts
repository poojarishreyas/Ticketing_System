import { Prisma, TicketPriority, TicketStatus } from '@prisma/client';

import { ServerAuthIdentity as Identity } from '@/lib/auth/auth-context';

export interface TicketQuerySchema {
  search?: string;
  status?: TicketStatus | 'all';
  priority?: TicketPriority | 'all';
  projectId?: string;
  clientId?: string;
  assignedToId?: string;
  reportedById?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  isOverdue?: boolean;
  dueToday?: boolean;
}

export class TicketQueryBuilder {
  static build(tenantId: string, user: Identity, query: TicketQuerySchema) {
    const where: Prisma.TicketWhereInput = { tenantId };

    // Role-based Isolation Enforcement
    // CLIENT users see all tickets belonging to their company (clientId), not just ones they created.
    if (user.role === 'CLIENT') {
      if (user.clientId) {
        where.clientId = user.clientId;
      } else {
        // Fallback: if clientId is not set, restrict to only their own tickets
        where.reportedById = user.id;
      }
    } else if (user.role === 'ENGINEER') {
      // Engineers can only see tickets assigned to them
      where.assignedToId = user.id;
    }

    if (query.search) {
      const isNumber = !isNaN(Number(query.search));

      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
        ...(isNumber ? [{ number: Number(query.search) }] : []),
        { project: { name: { contains: query.search, mode: 'insensitive' } } },
        { client: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    if (query.status && query.status !== 'all') {
      if (typeof query.status === 'string' && query.status.includes(',')) {
        where.status = { in: query.status.split(',') as TicketStatus[] };
      } else {
        where.status = query.status as TicketStatus;
      }
    }

    if (query.priority && query.priority !== 'all') {
      if (typeof query.priority === 'string' && query.priority.includes(',')) {
        where.priority = { in: query.priority.split(',') as TicketPriority[] };
      } else {
        where.priority = query.priority as TicketPriority;
      }
    }

    if (query.projectId) {
      where.projectId = query.projectId;
    }

    // Allow query to filter by client if user is not a client
    if (query.clientId && user.role !== 'CLIENT') {
      where.clientId = query.clientId;
    }

    if (query.assignedToId && user.role !== 'ENGINEER') {
      if (query.assignedToId === 'unassigned') {
        where.assignedToId = null;
      } else {
        where.assignedToId = query.assignedToId;
      }
    }

    if (query.reportedById) {
      where.reportedById = query.reportedById;
    }

    if (query.isOverdue) {
      where.sla = {
        is: {
          resolutionBreachAt: { lt: new Date() },
          resolvedAt: null,
        },
      };
    }

    if (query.dueToday) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      where.sla = {
        is: {
          resolutionBreachAt: { gte: startOfToday, lte: endOfToday },
          resolvedAt: null,
        },
      };
    }

    // Default sorting: highest priority first, then newest
    let orderBy: Prisma.TicketOrderByWithRelationInput | Prisma.TicketOrderByWithRelationInput[] = [
      { priority: 'desc' },
      { createdAt: 'desc' },
    ];

    if (query.sort && query.order) {
      switch (query.sort) {
        case 'number':
        case 'title':
        case 'createdAt':
        case 'updatedAt':
        case 'priority':
        case 'status':
          orderBy = { [query.sort]: query.order };
          break;
        case 'resolutionBreachAt':
          orderBy = { sla: { resolutionBreachAt: query.order } };
          break;
        case 'responseBreachAt':
          orderBy = { sla: { firstResponseBreachAt: query.order } };
          break;
        case 'project':
          orderBy = { project: { name: query.order } };
          break;
        case 'client':
          orderBy = { client: { name: query.order } };
          break;
      }
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 25));
    const skip = (page - 1) * limit;

    return {
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        project: { select: { id: true, name: true, code: true } },
        client: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        reportedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        category: { select: { id: true, name: true } },
        sla: true,
        _count: { select: { comments: true, attachments: true } },
      },
    };
  }
}
