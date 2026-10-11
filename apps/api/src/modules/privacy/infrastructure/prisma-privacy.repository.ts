import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import {
  ConsentCategory,
  ConsentSubjectKind,
  Locale,
  Prisma,
  PrivacyRequestStatus,
  PrivacyRequestType,
} from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type {
  PrivacyExportData,
  PrivacyRepository,
  PrivacyTransaction,
} from '../application/privacy.ports';
import type { PublicLocale } from '../domain/privacy';

const PRIVACY_TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 30_000 } as const;

function toPrismaLocale(locale: PublicLocale): Locale {
  return locale === 'en' ? Locale.EN : locale === 'es' ? Locale.ES : Locale.PT_BR;
}

function fromPrismaLocale(locale: Locale): PublicLocale {
  return locale === Locale.EN ? 'en' : locale === Locale.ES ? 'es' : 'pt-BR';
}

@Injectable()
export class PrismaPrivacyRepository implements PrivacyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRequest(input: Parameters<PrivacyRepository['createRequest']>[0]): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const emailKey = this.hashEmail(input.email);
      await tx.$queryRaw(Prisma.sql`
          SELECT 1 AS acquired
          FROM pg_advisory_xact_lock(hashtextextended(${emailKey}, 0))
        `);
      const tombstone = await tx.privacyErasureTombstone.findUnique({
        where: { emailKey },
        select: { erasedAt: true },
      });
      if (tombstone && tombstone.erasedAt > input.startedAt) return false;

      await tx.privacyRequest.create({
        data: {
          id: input.id,
          email: input.email,
          type: input.type as PrivacyRequestType,
          locale: toPrismaLocale(input.locale),
          verificationTokenHash: input.verificationTokenHash,
          verificationExpiresAt: input.verificationExpiresAt,
        },
      });
      await tx.outboxEvent.create({
        data: {
          eventName: 'privacy.verification.requested',
          aggregateType: 'PrivacyRequest',
          aggregateId: input.id,
          correlationId: input.correlationId,
          payload: {
            requestId: input.id,
          } satisfies Prisma.JsonObject,
        },
      });
      return true;
    }, PRIVACY_TRANSACTION_OPTIONS);
  }

  async withLockedRequest<T>(
    verificationTokenHash: string,
    execute: (requestId: string, transaction: PrivacyTransaction) => Promise<T>,
  ): Promise<T | null> {
    return this.prisma.$transaction(async (tx) => {
      const candidate = await tx.$queryRaw<Array<{ id: string; email: string }>>(Prisma.sql`
        SELECT id, email
        FROM privacy_requests
        WHERE verification_token_hash = ${verificationTokenHash}
      `);
      if (!candidate[0]) return null;
      await tx.$queryRaw(Prisma.sql`
        SELECT 1 AS acquired
        FROM pg_advisory_xact_lock(hashtextextended(${this.hashEmail(candidate[0].email)}, 0))
      `);
      const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM privacy_requests
        WHERE id = ${candidate[0].id}::uuid
          AND verification_token_hash = ${verificationTokenHash}
        FOR UPDATE
      `);
      if (!locked[0]) return null;

      const transaction: PrivacyTransaction = {
        getRequest: async (id) => {
          const request = await tx.privacyRequest.findUnique({ where: { id } });
          return request
            ? {
                id: request.id,
                email: request.email,
                type: request.type,
                status: request.status,
                locale: fromPrismaLocale(request.locale),
                verificationExpiresAt: request.verificationExpiresAt,
              }
            : null;
        },
        exportSubject: (email) => this.exportSubject(tx, email),
        completeExport: async (id, completedAt) => {
          await tx.privacyRequest.update({
            where: { id },
            data: {
              email: `deleted+${id}@privacy.invalid`,
              status: PrivacyRequestStatus.COMPLETED,
              verifiedAt: completedAt,
              completedAt,
              verificationTokenHash: null,
              verificationExpiresAt: null,
            },
          });
          await tx.outboxEvent.updateMany({
            where: { aggregateType: 'PrivacyRequest', aggregateId: id },
            data: { payload: { redacted: true, reason: 'privacy-completed' } },
          });
        },
        markDeleteVerified: async (
          id,
          confirmationTokenHash,
          confirmationExpiresAt,
          verifiedAt,
        ) => {
          await tx.privacyRequest.update({
            where: { id },
            data: {
              status: PrivacyRequestStatus.VERIFIED,
              verifiedAt,
              verificationTokenHash: confirmationTokenHash,
              verificationExpiresAt: confirmationExpiresAt,
            },
          });
        },
        expireRequest: async (id) => {
          await tx.privacyRequest.update({
            where: { id },
            data: {
              email: `deleted+${id}@privacy.invalid`,
              status: PrivacyRequestStatus.EXPIRED,
              verificationTokenHash: null,
              verificationExpiresAt: null,
            },
          });
          await tx.outboxEvent.updateMany({
            where: { aggregateType: 'PrivacyRequest', aggregateId: id },
            data: { payload: { redacted: true, reason: 'privacy-expired' } },
          });
        },
        deleteSubject: (input) => this.deleteSubject(tx, input),
      };
      return execute(locked[0].id, transaction);
    }, PRIVACY_TRANSACTION_OPTIONS);
  }

  async recordConsent(input: Parameters<PrivacyRepository['recordConsent']>[0]): Promise<void> {
    await this.prisma.consentRecord.create({
      data: {
        subjectKey: input.subjectKey,
        category: ConsentCategory.ANALYTICS,
        subjectKind:
          input.subjectKind === 'EMAIL'
            ? ConsentSubjectKind.EMAIL
            : ConsentSubjectKind.ANONYMOUS_BROWSER,
        granted: input.granted,
        policyVersion: input.policyVersion,
        locale: toPrismaLocale(input.locale),
        source: input.source,
        ipHash: input.ipHash,
      },
    });
  }

  private async exportSubject(
    tx: Prisma.TransactionClient,
    email: string,
  ): Promise<PrivacyExportData> {
    const [contacts, newsletter, consents, privacyRequests] = await Promise.all([
      tx.contactMessage.findMany({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          message: true,
          locale: true,
          status: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      tx.newsletterSubscriber.findUnique({
        where: { email },
        select: {
          email: true,
          locale: true,
          status: true,
          consentSource: true,
          confirmedAt: true,
          unsubscribedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.consentRecord.findMany({
        where: {
          subjectKey: this.hashEmail(email),
          subjectKind: ConsentSubjectKind.EMAIL,
        },
        select: {
          category: true,
          granted: true,
          policyVersion: true,
          locale: true,
          source: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      tx.privacyRequest.findMany({
        where: { email },
        select: {
          id: true,
          type: true,
          status: true,
          verifiedAt: true,
          completedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return { email, contacts, newsletter, consents, privacyRequests };
  }

  private async deleteSubject(
    tx: Prisma.TransactionClient,
    input: {
      requestId: string;
      email: string;
      completedAt: Date;
    },
  ): Promise<void> {
    await tx.$executeRaw(Prisma.sql`
      UPDATE contact_messages
      SET name = 'Titular anonimizado',
          email = 'deleted+' || id::text || '@privacy.invalid',
          subject = '[DADO REMOVIDO]',
          message = '[DADO REMOVIDO POR SOLICITAÇÃO DO TITULAR]',
          ip_hash = NULL
      WHERE email = ${input.email}
    `);
    await tx.newsletterSubscriber.deleteMany({ where: { email: input.email } });
    await tx.privacyErasureTombstone.upsert({
      where: { emailKey: this.hashEmail(input.email) },
      create: { emailKey: this.hashEmail(input.email), erasedAt: input.completedAt },
      update: { erasedAt: input.completedAt },
    });
    await tx.consentRecord.deleteMany({
      where: {
        subjectKey: this.hashEmail(input.email),
        subjectKind: ConsentSubjectKind.EMAIL,
      },
    });
    await tx.$executeRaw(Prisma.sql`
      UPDATE outbox_events
      SET payload = jsonb_build_object('redacted', true, 'reason', 'privacy-delete')
      WHERE payload ->> 'email' = ${input.email}
    `);
    await tx.$executeRaw(Prisma.sql`
      UPDATE privacy_requests
      SET email = 'deleted+' || id::text || '@privacy.invalid',
          status = CASE
            WHEN id = ${input.requestId}::uuid THEN 'COMPLETED'::"PrivacyRequestStatus"
            ELSE 'REJECTED'::"PrivacyRequestStatus"
          END,
          verified_at = CASE WHEN id = ${input.requestId}::uuid THEN ${input.completedAt} ELSE verified_at END,
          completed_at = CASE WHEN id = ${input.requestId}::uuid THEN ${input.completedAt} ELSE completed_at END,
          verification_token_hash = NULL,
          verification_expires_at = NULL
      WHERE email = ${input.email}
    `);
  }

  private hashEmail(email: string): string {
    const secret = process.env.PRIVACY_HASH_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_HASH_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return createHmac('sha256', secret).update(email).digest('hex');
  }
}
