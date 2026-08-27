/* eslint-disable */
import { Prisma, Ticket, TicketStatus } from '@prisma/client';

import { AuditService } from '@/services/audit/audit.service';
import { ticketRepository } from '@/repositories/ticket/ticket.repository';
import { ServerAuthIdentity as Identity } from '@/lib/auth/auth-context';
import { TicketQueryBuilder, TicketQuerySchema } from '@/lib/db/ticket-query-builder';
import { ForbiddenError } from '@/lib/errors/forbidden-error';
import { NotFoundError } from '@/lib/errors/not-found-error';
import { ValidationError } from '@/lib/errors/validation-error';
import { eventDispatcher } from '@/lib/events/dispatcher';
import {
  TicketAssignedEvent,
  TicketClosedEvent,
  TicketCreatedEvent,
  TicketPriorityChangedEvent,
  TicketReassignedEvent,
  TicketResolvedEvent,
  TicketStatusChangedEvent,
} from '@/lib/events/types';
import prisma from '@/lib/prisma';
import {
  AssignTicketInput,
  CreateTicketInput,
  UpdateTicketInput,
} from '@/lib/ticket/ticket.schema';

export class TicketService {
  /**
   * Retrieves a paginated list of tickets based on query parameters.
   */
  static async getTickets(tenantId: string, user: Identity, query: TicketQuerySchema) {
    const builderArgs = TicketQueryBuilder.build(tenantId, user, query);

    const [tickets, total] = await ticketRepository.findMany(builderArgs);

    const limit = builderArgs.take || 25;
    const page = query.page || 1;

    return {
      items: tickets,
      page,
      pageSize: limit,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves a single ticket by ID
   */
  static async getTicketById(id: string, tenantId: string, user?: Identity) {
    const ticket = await ticketRepository.findById(id, tenantId);
    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    if (user && user.role === 'CLIENT') {
      if (user.clientId && ticket.clientId !== user.clientId) {
        throw new NotFoundError('Ticket not found'); // Mask existence
      } else if (!user.clientId && ticket.reportedById !== user.id) {
        throw new NotFoundError('Ticket not found'); // Mask existence
      }
    } else if (user && user.role === 'ENGINEER') {
      if (ticket.assignedToId !== user.id) {
        throw new NotFoundError('Ticket not found'); // Mask existence
      }
    }

    return ticket;
  }

  /**
   * Retrieves dashboard statistics for tickets
   */
  static async getTicketStats(
    tenantId: string,
    user: Identity,
    clientId?: string,
    assignedToId?: string,
  ) {
    // If the user is a client, enforce their own clientId
    const targetClientId = user.role === 'CLIENT' ? user.clientId : clientId;

    // If the user is an engineer querying their own stats, they might not provide a clientId
    // If neither is provided, and the user is a client, we should throw an error.
    if (user.role === 'CLIENT' && !targetClientId) {
      throw new ValidationError([
        { message: 'Client ID is required for ticket stats', field: 'clientId' },
      ]);
    }

    const targetAssignedToId = user.role === 'ENGINEER' ? user.id : assignedToId;
    const options = { clientId: targetClientId, assignedToId: targetAssignedToId };
    const [stats, sla] = await Promise.all([
      ticketRepository.getDashboardSummaryCounts(options, tenantId),
      ticketRepository.getSLAStats(options, tenantId),
    ]);
    return { ...stats, sla };
  }

  /**
   * Creates a new ticket
   */
  static async createTicket(tenantId: string, reportedById: string, data: CreateTicketInput) {
    // We need the client ID. The project has a clientId, so we fetch it.
    const project = await prisma.project.findFirst({
      where: { id: data.projectId, tenantId },
    });

    if (!project) {
      throw new NotFoundError('Project not found');
    }

    // Wrap in transaction to ensure sequential number generation is safer
    const createdTicket = await prisma.$transaction(async (tx) => {
      const nextNumber = await ticketRepository.getNextTicketNumber(tenantId, tx);

      const ticket = await ticketRepository.create(
        {
          tenantId,
          projectId: data.projectId,
          clientId: project.clientId,
          number: nextNumber,
          title: data.title,
          description: data.description,
          priority: data.priority,
          categoryId: data.categoryId,
          reportedById,
        },
        tx,
      );

      // Snapshot SLA Policy
      const tenantPolicy = await prisma.sLAPolicy.findUnique({
        where: { tenantId },
        include: { tiers: true },
      });

      if (tenantPolicy) {
        const tier =
          tenantPolicy.tiers.find((t) => t.priority === ticket.priority) || tenantPolicy.tiers[0];
        if (tier) {
          await tx.ticketSLA.create({
            data: {
              ticketId: ticket.id,
              firstResponseTimeMins: tier.responseTimeMinutes,
              resolutionTimeMins: tier.resolutionTimeMinutes,
              businessHoursEnabled: tenantPolicy.businessHoursEnabled,
            },
          });
        }
      }

      await AuditService.log(
        {
          entity: 'Ticket',
          entityId: ticket.id,
          action: 'TICKET_CREATED',
          actorId: reportedById,
          tenantId,
          clientId: project.clientId,
          after: ticket as unknown as Record<string, unknown>,
        },
        tx,
      );

      return ticket;
    });

    // Dispatch event after successful commit
    eventDispatcher.publish(
      new TicketCreatedEvent(
        createdTicket.id,
        createdTicket.number,
        createdTicket.title,
        createdTicket.tenantId,
        createdTicket.projectId,
        createdTicket.clientId,
        createdTicket.reportedById,
        createdTicket.priority,
      ),
    );

    return createdTicket;
  }

  /**
   * Assigns a ticket to an engineer
   */
  static async assignTicket(
    id: string,
    tenantId: string,
    actor: Identity,
    data: AssignTicketInput,
  ) {
    const ticket = await this.getTicketById(id, tenantId, actor);

    if (actor.role === 'CLIENT') {
      throw new ValidationError([
        { message: 'Clients cannot assign tickets', field: 'assignedToId' },
      ]);
    }

    if (data.assignedToId) {
      const user = await prisma.user.findFirst({
        where: { id: data.assignedToId, tenantId },
      });
      if (!user) {
        throw new NotFoundError('Engineer not found');
      }
      if (user.role === 'CLIENT') {
        throw new ValidationError([
          { message: 'Cannot assign ticket to a client', field: 'assignedToId' },
        ]);
      }
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updatedTicket = await ticketRepository.update(
        id,
        tenantId,
        {
          assignedTo: data.assignedToId
            ? { connect: { id: data.assignedToId } }
            : { disconnect: true },
        },
        tx,
      );

      await AuditService.log(
        {
          entity: 'Ticket',
          entityId: ticket.id,
          action: data.assignedToId ? 'TICKET_ASSIGNED' : 'TICKET_UNASSIGNED',
          actorId: actor.id,
          tenantId,
          clientId: ticket.clientId,
          before: { assignedToId: ticket.assignedToId },
          after: { assignedToId: data.assignedToId },
        },
        tx,
      );

      return updatedTicket;
    });

    if (data.assignedToId) {
      if (ticket.assignedToId && ticket.assignedToId !== data.assignedToId) {
        eventDispatcher.publish(
          new TicketReassignedEvent(
            updatedTicket.id,
            updatedTicket.number,
            updatedTicket.tenantId,
            ticket.assignedToId,
            data.assignedToId,
            actor.id,
          ),
        );
      } else {
        eventDispatcher.publish(
          new TicketAssignedEvent(
            updatedTicket.id,
            updatedTicket.number,
            updatedTicket.tenantId,
            data.assignedToId,
            actor.id,
          ),
        );
      }
    }

    if (updatedTicket.status !== ticket.status) {
      eventDispatcher.publish(
        new TicketStatusChangedEvent(
          updatedTicket.id,
          updatedTicket.number,
          updatedTicket.tenantId,
          ticket.status,
          updatedTicket.status,
          actor.id,
        ),
      );
    }

    return updatedTicket;
  }

  /**
   * Updates ticket details
   */
  static async updateTicket(
    id: string,
    tenantId: string,
    actor: Identity,
    data: UpdateTicketInput,
  ) {
    const ticket = await this.getTicketById(id, tenantId, actor);

    if (actor.role === 'CLIENT') {
      // Clients can only update if it's explicitly allowed, e.g., closing their own ticket.
      // But for now, we'll restrict clients from direct PATCH updates.
      throw new ValidationError([
        { message: 'Clients cannot update ticket properties directly', field: 'status' },
      ]);
    }

    if (actor.role === 'ENGINEER' && ticket.assignedToId !== actor.id) {
      throw new ForbiddenError('Engineers can only update tickets assigned to them');
    }

    if (ticket.status === 'CLOSED' && data.status !== 'CLOSED') {
      throw new ValidationError([
        { message: 'Cannot edit a closed ticket unless reopening it (if workflow allows).' },
      ]);
    }

    const updatedTicket = await prisma.$transaction(async (tx) => {
      const updatedData: Prisma.TicketUpdateInput = { ...data };

      if (data.status === 'RESOLVED' && ticket.status !== 'RESOLVED') {
        updatedData.resolvedAt = new Date();
      } else if (data.status === 'CLOSED' && ticket.status !== 'CLOSED') {
        updatedData.closedAt = new Date();
      }

      const updatedTicket = await ticketRepository.update(id, tenantId, updatedData, tx);

      const action =
        data.status && data.status !== ticket.status
          ? 'TICKET_STATUS_CHANGED'
          : data.priority && data.priority !== ticket.priority
            ? 'TICKET_PRIORITY_CHANGED'
            : 'TICKET_UPDATED';

      await AuditService.log(
        {
          entity: 'Ticket',
          entityId: ticket.id,
          action,
          actorId: actor.id,
          tenantId,
          clientId: ticket.clientId,
          before: {
            title: ticket.title,
            description: ticket.description,
            status: ticket.status,
            priority: ticket.priority,
            categoryId: ticket.categoryId,
          },
          after: {
            title: updatedTicket.title,
            description: updatedTicket.description,
            status: updatedTicket.status,
            priority: updatedTicket.priority,
            categoryId: updatedTicket.categoryId,
          },
        },
        tx,
      );

      return updatedTicket;
    });

    if (data.status && data.status !== ticket.status) {
      eventDispatcher.publish(
        new TicketStatusChangedEvent(
          updatedTicket.id,
          updatedTicket.number,
          updatedTicket.tenantId,
          ticket.status,
          updatedTicket.status,
          actor.id,
        ),
      );
      if (updatedTicket.status === 'RESOLVED') {
        eventDispatcher.publish(
          new TicketResolvedEvent(
            updatedTicket.id,
            updatedTicket.number,
            updatedTicket.tenantId,
            actor.id,
          ),
        );
      } else if (updatedTicket.status === 'CLOSED') {
        eventDispatcher.publish(
          new TicketClosedEvent(
            updatedTicket.id,
            updatedTicket.number,
            updatedTicket.tenantId,
            actor.id,
          ),
        );
      }
    }

    if (data.priority && data.priority !== ticket.priority) {
      eventDispatcher.publish(
        new TicketPriorityChangedEvent(
          updatedTicket.id,
          updatedTicket.number,
          updatedTicket.tenantId,
          ticket.priority,
          updatedTicket.priority,
          actor.id,
        ),
      );
    }

    return updatedTicket;
  }
}
