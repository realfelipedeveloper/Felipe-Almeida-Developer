import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PrismaPrivacyRepository } from '../src/modules/privacy/infrastructure/prisma-privacy.repository';
import { PrivacyService } from '../src/modules/privacy/application/privacy.service';
import { EngagementService } from '../src/modules/engagement/application/engagement.service';

describe('privacidade transacional (PostgreSQL real)', () => {
  jest.setTimeout(120_000);
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let repository: PrismaPrivacyRepository;
  let service: PrivacyService;
  let engagement: EngagementService;

  beforeAll(async () => {
    process.env.PRIVACY_REQUEST_TOKEN_SECRET = 'p'.repeat(64);
    process.env.PRIVACY_HASH_SECRET = 'h'.repeat(64);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    prisma = new PrismaClient({ datasources: { db: { url: container.getConnectionUri() } } });
    for (const sql of schemaSql) await prisma.$executeRawUnsafe(sql);
    repository = new PrismaPrivacyRepository(prisma as never);
    service = new PrivacyService(
      repository,
      { increment: async () => 1 },
      { info: () => undefined, warn: () => undefined },
    );
    engagement = new EngagementService(
      prisma as never,
      { connection: { eval: async () => 1 } } as never,
      { child: () => ({ info: () => undefined, warn: () => undefined }) } as never,
    );
  });

  beforeEach(async () => {
    await prisma.$executeRawUnsafe(
      'TRUNCATE privacy_requests, privacy_erasure_tombstones, contact_messages, newsletter_tokens, newsletter_subscribers, consent_records, outbox_events CASCADE',
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('permite apenas uma exportação em duas verificações simultâneas', async () => {
    const id = randomUUID();
    const token = requestToken(id, 'EXPORT');
    await insertRequest(id, 'owner@example.com', 'EXPORT', 'PENDING', token);

    const results = await Promise.allSettled([
      service.verify(token, 'ip-a'),
      service.verify(token, 'ip-b'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const persisted = await prisma.privacyRequest.findUnique({ where: { id } });
    expect(persisted).toMatchObject({ status: 'COMPLETED', verificationTokenHash: null });
    expect(persisted?.email).toBe(`deleted+${id}@privacy.invalid`);
  });

  it('serializa DELETE contra EXPORT do mesmo titular e invalida a exportação concorrente', async () => {
    const deleteId = randomUUID();
    const exportId = randomUUID();
    const deleteToken = confirmationToken(deleteId);
    const exportToken = requestToken(exportId, 'EXPORT');
    await insertRequest(deleteId, 'owner@example.com', 'DELETE', 'VERIFIED', deleteToken);
    await insertRequest(exportId, 'owner@example.com', 'EXPORT', 'PENDING', exportToken);

    let release!: () => void;
    const mayDelete = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const subjectLocked = new Promise<void>((resolve) => (locked = resolve));
    const deletion = repository.withLockedRequest(hash(deleteToken), async (requestId, unit) => {
      locked();
      await mayDelete;
      await unit.deleteSubject({
        requestId,
        email: 'owner@example.com',
        completedAt: new Date(),
      });
    });
    await subjectLocked;
    const exportAttempt = service.verify(exportToken, 'ip-c');
    const contactAttempt = engagement.submitContact(
      {
        name: 'Owner',
        email: 'owner@example.com',
        subject: 'Concorrente',
        message: 'Não deve sobreviver à exclusão em andamento.',
        locale: 'pt-BR',
      },
      '203.0.113.20',
    );
    const privacyRequestAttempt = service.request(
      { email: 'owner@example.com', type: 'EXPORT', locale: 'pt-BR' },
      '203.0.113.21',
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    release();

    await deletion;
    await expect(exportAttempt).rejects.toMatchObject({ status: 400 });
    await contactAttempt;
    await expect(privacyRequestAttempt).resolves.toEqual({
      message: 'Se o endereço for válido, enviaremos um link de verificação.',
    });
    expect(await prisma.contactMessage.count({ where: { email: 'owner@example.com' } })).toBe(0);
    expect(await prisma.privacyRequest.count({ where: { email: 'owner@example.com' } })).toBe(0);
    expect(
      await prisma.outboxEvent.count({ where: { eventName: 'privacy.verification.requested' } }),
    ).toBe(0);
  });

  it('faz rollback integral quando a exclusão falha antes do commit', async () => {
    const id = randomUUID();
    const token = confirmationToken(id);
    await insertRequest(id, 'owner@example.com', 'DELETE', 'VERIFIED', token);
    await prisma.contactMessage.create({
      data: {
        name: 'Owner',
        email: 'owner@example.com',
        subject: 'Assunto',
        message: 'Mensagem',
        locale: 'PT_BR',
      },
    });

    await expect(
      repository.withLockedRequest(hash(token), async (requestId, unit) => {
        await unit.deleteSubject({
          requestId,
          email: 'owner@example.com',
          completedAt: new Date(),
        });
        throw new Error('falha simulada');
      }),
    ).rejects.toThrow('falha simulada');
    expect(await prisma.contactMessage.count({ where: { email: 'owner@example.com' } })).toBe(1);
    expect(await prisma.privacyRequest.findUnique({ where: { id } })).toMatchObject({
      email: 'owner@example.com',
      status: 'VERIFIED',
    });
  });

  async function insertRequest(
    id: string,
    email: string,
    type: 'EXPORT' | 'DELETE',
    status: 'PENDING' | 'VERIFIED',
    token: string,
  ): Promise<void> {
    await prisma.privacyRequest.create({
      data: {
        id,
        email,
        type,
        status,
        locale: 'PT_BR',
        verificationTokenHash: hash(token),
        verificationExpiresAt: new Date(Date.now() + 60_000),
      },
    });
  }
});

function requestToken(id: string, type: 'EXPORT' | 'DELETE'): string {
  return `${id}.${createHmac('sha256', 'p'.repeat(64))
    .update(`privacy-request:${id}:${type}`)
    .digest('base64url')}`;
}

function confirmationToken(id: string): string {
  return `${id}.${createHmac('sha256', 'p'.repeat(64))
    .update(`privacy-delete-confirmation:${id}`)
    .digest('base64url')}`;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

const schemaSql = [
  `CREATE TYPE "Locale" AS ENUM ('pt-BR', 'en', 'es')`,
  `CREATE TYPE "PrivacyRequestType" AS ENUM ('EXPORT', 'DELETE')`,
  `CREATE TYPE "PrivacyRequestStatus" AS ENUM ('PENDING','VERIFIED','PROCESSING','COMPLETED','REJECTED','EXPIRED')`,
  `CREATE TYPE "ConsentCategory" AS ENUM ('ANALYTICS')`,
  `CREATE TYPE "ConsentSubjectKind" AS ENUM ('ANONYMOUS_BROWSER','EMAIL')`,
  `CREATE TYPE "ContactStatus" AS ENUM ('NEW','IN_PROGRESS','RESOLVED','SPAM')`,
  `CREATE TABLE privacy_requests (
    id UUID PRIMARY KEY, email VARCHAR(320) NOT NULL, type "PrivacyRequestType" NOT NULL,
    status "PrivacyRequestStatus" NOT NULL DEFAULT 'PENDING', locale "Locale" NOT NULL DEFAULT 'pt-BR',
    verification_token_hash VARCHAR(128) UNIQUE, verification_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, result_storage_key VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE privacy_erasure_tombstones (
    email_key VARCHAR(128) PRIMARY KEY, erased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name VARCHAR(160) NOT NULL, email VARCHAR(320) NOT NULL,
    subject VARCHAR(240) NOT NULL, message TEXT NOT NULL, locale "Locale" NOT NULL DEFAULT 'pt-BR',
    status "ContactStatus" NOT NULL DEFAULT 'NEW', ip_hash VARCHAR(128), correlation_id UUID DEFAULT gen_random_uuid(),
    resolved_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(320) UNIQUE NOT NULL, locale "Locale" NOT NULL DEFAULT 'pt-BR',
    status TEXT NOT NULL DEFAULT 'PENDING', consent_source VARCHAR(120), consent_ip_hash VARCHAR(128),
    confirmed_at TIMESTAMPTZ, unsubscribed_at TIMESTAMPTZ, bounce_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE newsletter_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subscriber_id UUID NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL, token_hash VARCHAR(128) UNIQUE NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_key VARCHAR(128) NOT NULL,
    category "ConsentCategory" NOT NULL, subject_kind "ConsentSubjectKind" NOT NULL DEFAULT 'ANONYMOUS_BROWSER',
    granted BOOLEAN NOT NULL, policy_version VARCHAR(40) NOT NULL, locale "Locale" NOT NULL DEFAULT 'pt-BR',
    source VARCHAR(120), ip_hash VARCHAR(128), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), event_name VARCHAR(160) NOT NULL, version INT NOT NULL DEFAULT 1,
    aggregate_type VARCHAR(120), aggregate_id VARCHAR(120), correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
    payload JSONB NOT NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ, attempts INT NOT NULL DEFAULT 0, last_error TEXT
  )`,
];
