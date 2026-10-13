import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContactStatus,
  NewsletterSubscriberStatus,
  Prisma,
  PublicationStatus,
} from '@prisma/client';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import {
  RICH_TEXT_SANITIZER,
  type RichTextSanitizer,
} from '../../../shared/application/rich-text-sanitizer';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type { AuthenticatedAdmin } from '../../auth/application/auth.types';
import type { UpsertNewsletterIssueAdminDto } from '../presentation/dto/admin-engagement.dto';

@Injectable()
export class AdminEngagementService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(RICH_TEXT_SANITIZER)
    private readonly richTextSanitizer: RichTextSanitizer,
  ) {}

  listContacts(status?: ContactStatus) {
    return this.prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 250,
    });
  }

  async updateContactStatus(id: string, status: ContactStatus, admin: AuthenticatedAdmin) {
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
    return this.prisma.$transaction(
      async (tx) => {
        const candidate = await tx.newsletterSubscriber.findUnique({ where: { id } });
        if (!candidate) throw new NotFoundException('Inscrito não encontrado.');
        const subjectKey = this.privacySubjectKey(candidate.email);
        await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '5000ms'`);
        await tx.$queryRaw(Prisma.sql`
        SELECT 1 AS acquired
        FROM pg_advisory_xact_lock(hashtextextended(${subjectKey}, 0))
      `);
        const current = await tx.newsletterSubscriber.findUnique({ where: { id } });
        if (!current || current.email !== candidate.email) {
          throw new NotFoundException('Inscrito não encontrado.');
        }
        if (
          status === NewsletterSubscriberStatus.ACTIVE &&
          current.status !== NewsletterSubscriberStatus.ACTIVE
        ) {
          throw new BadRequestException(
            'A ativação exige confirmação pelo link de double opt-in enviado ao titular.',
          );
        }
        const updated = await tx.newsletterSubscriber.update({
          where: { id },
          data: {
            status,
            confirmedAt:
              status === NewsletterSubscriberStatus.ACTIVE
                ? (current.confirmedAt ?? new Date())
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
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
  }

  listIssues() {
    return this.prisma.newsletterIssue.findMany({
      include: { translations: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getIssue(id: string) {
    const issue = await this.prisma.newsletterIssue.findUnique({
      where: { id },
      include: { translations: true },
    });
    if (!issue) throw new NotFoundException('Edição da newsletter não encontrada.');
    return issue;
  }

  async createIssue(body: UpsertNewsletterIssueAdminDto, admin: AuthenticatedAdmin) {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const issue = await tx.newsletterIssue.create({ data: this.issueData(body) });
        if (this.isPublicationDue(issue)) {
          await this.publishIssueEvent(tx, issue.id);
        }
        await this.audit(tx, admin, 'NEWSLETTER_ISSUE_CREATED', 'NewsletterIssue', issue.id);
        return issue;
      });
      return this.getIssue(created.id);
    } catch (error) {
      this.handleIssueConflict(error);
    }
  }

  async updateIssue(id: string, body: UpsertNewsletterIssueAdminDto, admin: AuthenticatedAdmin) {
    try {
      await this.prisma.$transaction(async (tx) => {
        const [current] = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`
            SELECT id
            FROM newsletter_issues
            WHERE id = ${id}::uuid
            FOR UPDATE
          `,
        );
        if (!current) throw new NotFoundException('Edição da newsletter não encontrada.');
        await tx.newsletterIssueTranslation.deleteMany({ where: { issueId: id } });
        const updated = await tx.newsletterIssue.update({
          where: { id },
          data: this.issueData(body),
        });
        if (!updated.publishedEventAt && this.isPublicationDue(updated)) {
          await this.publishIssueEvent(tx, id);
        }
        await this.audit(tx, admin, 'NEWSLETTER_ISSUE_UPDATED', 'NewsletterIssue', id);
      });
      return this.getIssue(id);
    } catch (error) {
      this.handleIssueConflict(error);
    }
  }

  async deleteIssue(id: string, admin: AuthenticatedAdmin): Promise<void> {
    const current = await this.prisma.newsletterIssue.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!current) throw new NotFoundException('Edição da newsletter não encontrada.');
    await this.prisma.$transaction(async (tx) => {
      await tx.newsletterIssue.delete({ where: { id } });
      await this.audit(tx, admin, 'NEWSLETTER_ISSUE_DELETED', 'NewsletterIssue', id);
    });
  }

  private issueData(body: UpsertNewsletterIssueAdminDto) {
    return {
      publicationStatus: body.publicationStatus,
      scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      publishedAt:
        body.publishedAt != null
          ? new Date(body.publishedAt)
          : body.publicationStatus === PublicationStatus.PUBLISHED
            ? new Date()
            : null,
      translations: {
        create: body.translations.map((translation) => ({
          locale: toPrismaLocale(translation.locale),
          subject: translation.subject.trim(),
          previewText: translation.previewText?.trim() || null,
          bodyHtml: this.sanitizeIssueBody(translation.bodyHtml),
        })),
      },
    } satisfies Prisma.NewsletterIssueCreateInput;
  }

  private sanitizeIssueBody(value: string): string {
    const sanitized = this.richTextSanitizer.sanitize(value);
    if (!this.richTextSanitizer.hasMeaningfulContent(sanitized)) {
      throw new BadRequestException(
        'O conteúdo da edição não pode ficar vazio após a sanitização.',
      );
    }
    return sanitized;
  }

  private isPublicationDue(input: {
    publicationStatus: PublicationStatus;
    publishedAt: Date | null;
    scheduledAt: Date | null;
  }): boolean {
    const now = Date.now();
    return (
      input.publicationStatus === PublicationStatus.PUBLISHED &&
      input.publishedAt !== null &&
      input.publishedAt.getTime() <= now &&
      (input.scheduledAt === null || input.scheduledAt.getTime() <= now)
    );
  }

  private privacySubjectKey(email: string): string {
    const secret = process.env.PRIVACY_HASH_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_HASH_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return createHmac('sha256', secret).update(email).digest('hex');
  }

  private async publishIssueEvent(tx: Prisma.TransactionClient, issueId: string): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventName: 'newsletter.issue.published',
        aggregateType: 'NewsletterIssue',
        aggregateId: issueId,
        correlationId: randomUUID(),
        payload: { issueId } satisfies Prisma.JsonObject,
      },
    });
    await tx.newsletterIssue.update({
      where: { id: issueId },
      data: { publishedEventAt: new Date() },
    });
  }

  private handleIssueConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Já existe uma tradução conflitante para esta edição.');
    }
    throw error;
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
