/* eslint-disable */
import crypto from 'crypto';

import { env } from '@/config/env';
import { Client, ClientStatus, Prisma, Project, Role } from '@prisma/client';

import { AuditService } from '@/services/audit/audit.service';
import { DbClient, runInTransaction } from '@/services/base/transaction';
import { emailService } from '@/services/email/email.service';
import { clientRepository } from '@/repositories/client/client.repository';
import { ProjectRepository } from '@/repositories/project/project.repository';
import { ticketRepository } from '@/repositories/ticket/ticket.repository';
import { userRepository } from '@/repositories/user/user.repository';
import {
  ClientQuery,
  CreateClientInput,
  OnboardClientInput,
  UpdateClientInput,
} from '@/lib/client/client.schema';
import { ConflictError } from '@/lib/errors/conflict-error';
import { EmailDeliveryError } from '@/lib/errors/email-error';
import { NotFoundError } from '@/lib/errors/not-found-error';
import prisma from '@/lib/prisma';

const APP_URL = env.NEXT_PUBLIC_APP_URL;
const INVITATION_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export class ClientService {
  async createClient(
    tenantId: string,
    data: CreateClientInput,
    actorId: string,
    tx?: DbClient,
  ): Promise<Client> {
    if (data.email) {
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError('A user with this email already exists.');
      }
    }

    let emailPayload: { email: string; rawToken: string } | null = null;

    const createdClient = await runInTransaction(async (db) => {
      const client = await clientRepository.create(
        {
          tenantId,
          name: data.name,
          code: data.code || null,
          email: data.email || null,
          phone: data.phone || null,
          website: data.website || null,
          contactName: data.contactName || null,
          address: data.address || null,
          industry: data.industry || null,
          notes: data.notes || null,
          status: data.email ? ClientStatus.PENDING_ACTIVATION : ClientStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        db,
      );

      // Create Client Portal Account if email is provided
      if (data.email) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
        const placeholderPassword = crypto.randomBytes(16).toString('hex');

        let firstName = 'Client';
        let lastName = 'User';
        if (data.contactName) {
          const nameParts = data.contactName.trim().split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ') || 'User';
        }

        try {
          const user = await userRepository.create(
            tenantId,
            {
              firstName,
              lastName,
              email: data.email,
              password: placeholderPassword,
              role: Role.CLIENT,
              mustChangePassword: false,
              clientId: client.id,
            },
            actorId,
            db,
          );

          await db.user.update({
            where: { id: user.id },
            data: {
              status: 'INVITED',
              invitationTokenHash: tokenHash,
              invitationExpiresAt: expiresAt,
              invitedAt: new Date(),
            },
          });

          emailPayload = { email: user.email, rawToken };
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            Array.isArray(error.meta?.target) &&
            error.meta.target.includes('email')
          ) {
            throw new ConflictError('A user with this email already exists.');
          }
          throw error;
        }
      }

      return client;
    }, tx);

    if (emailPayload !== null) {
      const { email: recipientEmail, rawToken: inviteToken } = emailPayload;
      try {
        await emailService.sendInvitation(recipientEmail, inviteToken, APP_URL);
      } catch (emailError) {
        // We log the error but do not fail the client creation just because email failed.
        // Usually we might compensate and delete, but here creating the client is primary.
        console.error(
          `[ClientService] Failed to send invitation email to ${recipientEmail}:`,
          emailError,
        );
      }
    }

    return createdClient;
  }

  async onboardClient(
    tenantId: string,
    data: OnboardClientInput,
    actorId: string,
    tx?: DbClient,
  ): Promise<{ client: Client; project: Project }> {
    if (data.email) {
      const existingUser = await userRepository.findByEmail(data.email);
      if (existingUser) {
        throw new ConflictError('A user with this email already exists.');
      }
    }

    let emailPayload: { email: string; rawToken: string } | null = null;

    const result = await runInTransaction(async (db) => {
      // Create Client
      const client = await clientRepository.create(
        {
          tenantId,
          name: data.name,
          code: data.code || null,
          email: data.email || null,
          website: data.website || null,
          contactName: data.contactName || null,
          address: data.address || null,
          industry: data.industry || null,
          notes: data.notes || null,
          status: data.email ? ClientStatus.PENDING_ACTIVATION : ClientStatus.ACTIVE,
          createdById: actorId,
          updatedById: actorId,
        },
        db,
      );

      // Prevent Duplicate Project Name under the same client
      const existingProject = await ProjectRepository.existsByName(
        tenantId,
        client.id,
        data.project.name,
        db as Prisma.TransactionClient,
      );
      if (existingProject) {
        throw new ConflictError('A project with this name already exists.');
      }

      // Create Initial Project
      const project = await ProjectRepository.create(
        {
          tenantId,
          clientId: client.id,
          name: data.project.name,
          code: data.project.code || null,
          description: data.project.description || null,
          status: 'ACTIVE',
          createdById: actorId,
          updatedById: actorId,
        },
        db as Prisma.TransactionClient,
      );

      // Audit Logs
      await AuditService.log(
        {
          entity: 'Client',
          entityId: client.id,
          action: 'CLIENT_ONBOARDED',
          actorId,
          after: client,
        },
        db as Prisma.TransactionClient,
      );

      await AuditService.log(
        {
          entity: 'Project',
          entityId: project.id,
          action: 'PROJECT_CREATED',
          actorId,
          after: project,
        },
        db as Prisma.TransactionClient,
      );

      // Create Client Portal Account if email is provided
      if (data.email) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
        const placeholderPassword = crypto.randomBytes(16).toString('hex');

        let firstName = 'Client';
        let lastName = 'User';
        if (data.contactName) {
          const nameParts = data.contactName.trim().split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ') || 'User';
        }

        try {
          const user = await userRepository.create(
            tenantId,
            {
              firstName,
              lastName,
              email: data.email,
              password: placeholderPassword,
              role: Role.CLIENT,
              mustChangePassword: false,
              clientId: client.id,
            },
            actorId,
            db,
          );

          await db.user.update({
            where: { id: user.id },
            data: {
              status: 'INVITED',
              invitationTokenHash: tokenHash,
              invitationExpiresAt: expiresAt,
              invitedAt: new Date(),
            },
          });

          emailPayload = { email: user.email, rawToken };
        } catch (error: unknown) {
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002' &&
            Array.isArray(error.meta?.target) &&
            error.meta.target.includes('email')
          ) {
            throw new ConflictError('A user with this email already exists.');
          }
          throw error;
        }
      }

      return { client, project };
    }, tx);

    if (emailPayload !== null) {
      const { email: recipientEmail, rawToken: inviteToken } = emailPayload;
      try {
        await emailService.sendInvitation(recipientEmail, inviteToken, APP_URL);
      } catch (emailError) {
        console.error(
          `[ClientService] Failed to send invitation email to ${recipientEmail}:`,
          emailError,
        );
      }
    }

    return result;
  }

  async getClientById(tenantId: string, id: string): Promise<Client> {
    const client = await clientRepository.findById(id);

    if (!client) {
      throw new NotFoundError('Client not found');
    }

    if (client.tenantId !== tenantId) {
      throw new NotFoundError('Client not found'); // Use 404 to avoid leaking existence
    }

    return client;
  }

  async getClientOverviewStats(tenantId: string, clientId: string) {
    const [client, summaryCounts, slaStats, projects, tickets] = await Promise.all([
      this.getClientById(tenantId, clientId), // ensure existence/ownership
      // @ts-ignore
      ticketRepository.getDashboardSummaryCounts(clientId, tenantId),
      ticketRepository.getSLAStatsForClient(clientId, tenantId),
      prisma.project.count({ where: { clientId, tenantId, archivedAt: null } }),
      prisma.ticket.findMany({
        where: { clientId, tenantId },
        select: { assignedToId: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const totalTickets = tickets.length;
    const uniqueEngineers = new Set<string>();
    for (const t of tickets) {
      if (t.assignedToId) uniqueEngineers.add(t.assignedToId);
    }

    let lastActivity = client.updatedAt;
    if (tickets.length > 0) {
      lastActivity =
        tickets[0].updatedAt > client.updatedAt ? tickets[0].updatedAt : client.updatedAt;
    }

    return {
      totalProjects: projects,
      totalTickets,
      engineersCount: uniqueEngineers.size,
      slaHealthPercent: slaStats.withinSLAPercent,
      avgResolutionTimeMinutes: slaStats.avgResolutionTimeMinutes,
      lastActivity: lastActivity.toISOString(),
    };
  }

  async getClients(tenantId: string, query: ClientQuery) {
    const { clients, total } = await clientRepository.findMany({ tenantId, query });

    return {
      data: clients.map((c) => ({
        ...c,
        projectsCount: (c as any)._count?.projects || 0,
      })),
      total,
      pages: Math.ceil(total / query.limit),
    };
  }

  async updateClient(
    tenantId: string,
    id: string,
    data: UpdateClientInput,
    actorId: string,
    tx?: DbClient,
  ): Promise<Client> {
    return runInTransaction(async (db) => {
      const client = await this.getClientById(tenantId, id);

      return clientRepository.update(
        id,
        {
          name: data.name ?? client.name,
          code: data.code !== undefined ? data.code || null : client.code,
          email: data.email !== undefined ? data.email || null : client.email,
          phone: data.phone !== undefined ? data.phone || null : client.phone,
          website: data.website !== undefined ? data.website || null : client.website,
          contactName:
            data.contactName !== undefined ? data.contactName || null : client.contactName,
          address: data.address !== undefined ? data.address || null : client.address,
          industry: data.industry !== undefined ? data.industry || null : client.industry,
          notes: data.notes !== undefined ? data.notes || null : client.notes,
          status: data.status ?? client.status,
          updatedById: actorId,
        },
        db,
      );
    }, tx);
  }

  async archiveClient(
    tenantId: string,
    id: string,
    actorId: string,
    tx?: DbClient,
  ): Promise<Client> {
    return runInTransaction(async (db) => {
      // Validate existence and ownership
      await this.getClientById(tenantId, id);

      // Find all users belonging to this client
      const usersToArchive = await db.user.findMany({
        where: { clientId: id, tenantId: tenantId, deletedAt: null }
      });

      // Soft-delete and scramble email to prevent unique constraint conflicts on re-creation
      for (const user of usersToArchive) {
        await db.user.update({
          where: { id: user.id },
          data: {
            email: `${user.email}.archived.${Date.now()}`,
            status: 'INACTIVE',
            deletedAt: new Date(),
            updatedBy: actorId,
          }
        });
      }

      return clientRepository.archive(id, actorId, db);
    }, tx);
  }
}

export const clientService = new ClientService();
