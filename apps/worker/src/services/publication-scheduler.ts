import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { logger } from '../infra/logger.js';
import { workerMetrics, type WorkerMetrics } from '../infra/worker-metrics.js';

const INTERVAL_MS = 30_000;
const BATCH_SIZE = 50;

interface ScheduledRow {
  id: string;
}

export class PublicationScheduler {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly metrics: WorkerMetrics = workerMetrics,
  ) {}

  start(): void {
    void this.tick();
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const articles = await tx.$queryRaw<ScheduledRow[]>(Prisma.sql`
          SELECT id
          FROM articles
          WHERE publication_status = 'PUBLISHED'::"PublicationStatus"
            AND published_event_at IS NULL
            AND published_at <= ${now}
            AND (scheduled_at IS NULL OR scheduled_at <= ${now})
          ORDER BY COALESCE(scheduled_at, published_at), id
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        `);
        for (const article of articles) {
          await this.createEvent(tx, 'article.published', 'Article', article.id, {
            articleId: article.id,
          });
          await tx.article.update({
            where: { id: article.id },
            data: { publishedEventAt: now },
          });
          this.metrics.increment('scheduled_article_published');
        }

        const issues = await tx.$queryRaw<ScheduledRow[]>(Prisma.sql`
          SELECT id
          FROM newsletter_issues
          WHERE publication_status = 'PUBLISHED'::"PublicationStatus"
            AND published_event_at IS NULL
            AND published_at <= ${now}
            AND (scheduled_at IS NULL OR scheduled_at <= ${now})
          ORDER BY COALESCE(scheduled_at, published_at), id
          LIMIT ${BATCH_SIZE}
          FOR UPDATE SKIP LOCKED
        `);
        for (const issue of issues) {
          await this.createEvent(tx, 'newsletter.issue.published', 'NewsletterIssue', issue.id, {
            issueId: issue.id,
          });
          await tx.newsletterIssue.update({
            where: { id: issue.id },
            data: { publishedEventAt: now },
          });
          this.metrics.increment('scheduled_newsletter_issue_published');
        }
      });
    } catch {
      this.metrics.increment('publication_scheduler_failed');
      logger.error(
        { categoria: 'filas', codigo: 'PUBLICATION_SCHEDULER_FAILED' },
        'Falha ao publicar conteúdo agendado',
      );
    } finally {
      this.running = false;
    }
  }

  private async createEvent(
    tx: Prisma.TransactionClient,
    eventName: string,
    aggregateType: string,
    aggregateId: string,
    payload: Prisma.JsonObject,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        id: randomUUID(),
        eventName,
        aggregateType,
        aggregateId,
        correlationId: randomUUID(),
        payload,
      },
    });
  }
}
