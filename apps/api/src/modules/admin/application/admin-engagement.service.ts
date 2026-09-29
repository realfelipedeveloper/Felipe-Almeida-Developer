import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContactStatus,
  NewsletterSubscriberStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';

@Injectable()
export class AdminEngagementService {
  constructor(private readonly prisma: PrismaService) {}

  listContacts(status?: ContactStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async updateContactStatus(
    id: string,
    status: ContactStatus,
    admin: AuthenticatedAdmin,
  ) {
    const current = await this.prisma.contactMessage.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Mensagem de contato não encontrada.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.contactMessage.update({
        where: { id },
        data: {
          status,
          resolvedAt: status === ContactStatus.RESOLVED ? new Date() : null,
        },
      });
      await this.audit(tx, admin, 'CONTACT_STATUS_UPDATED', 'ContactMessage', id);
      return updated;
    });
  }

  listSubscribers(status?: NewsletterSubscriberStatus) {
    return this.prisma.newsletterSubscriber.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async updateSubscriberStatus(
    id: string,
    status: NewsletterSubscriberStatus,
    admin: AuthenticatedAdmin,
  ) {
    const current = await this.prisma.newsletterSubscriber.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Inscrito não encontrado.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.newsletterSubscriber.update({
        where: { id },
        data: {
          status,
          confirmedAt:
            status === NewsletterSubscriberStatus.ACTIVE
              ? current.confirmedAt ?? new Date()
              : current.confirmedAt,
          unsubscribedAt:
            status === NewsletterSubscriberStatus.UNSUBSCRIBED
              ? new Date()
              : status === NewsletterSubscriberStatus.ACTIVE
                ? null
                : current.unsubscribedAt,
        },
      });
      await this.audit(tx, admin, 'NEWSLETTER_STATUS_UPDATED', 'NewsletterSubscriber', id);
      return updated;
    });
  }

  private async audit(
    tx: Prisma.TransactionClient,
    admin: AuthenticatedAdmin,
    action: string,
    resourceType: string,
    resourceId: string,
  ) {
    await tx.auditLog.create({
      data: {
        actorAdminId: admin.id,
        action,
        resourceType,
        resourceId,
      },
    });
  }
}
