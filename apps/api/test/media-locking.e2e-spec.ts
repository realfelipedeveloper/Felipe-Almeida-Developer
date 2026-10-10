import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('locks de referência de mídia (PostgreSQL real)', () => {
  jest.setTimeout(120_000);

  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    prisma = new PrismaClient({
      datasources: { db: { url: container.getConnectionUri() } },
    });
    await prisma.$executeRawUnsafe(`
      CREATE TABLE media_assets (
        id UUID PRIMARY KEY,
        deleted_at TIMESTAMPTZ,
        storage_ready_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE articles (
        id UUID PRIMARY KEY,
        cover_media_id UUID REFERENCES media_assets(id)
      )
    `);
    await prisma.$executeRawUnsafe(
      `INSERT INTO media_assets (id) VALUES ('55ed9830-d52d-47c4-8755-23522d940f53')`,
    );
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('FOR UPDATE aguarda FOR KEY SHARE e enxerga a referência após o commit', async () => {
    let releaseAttachment!: () => void;
    const attachmentMayCommit = new Promise<void>((resolve) => {
      releaseAttachment = resolve;
    });
    let mediaLocked!: () => void;
    const mediaIsLocked = new Promise<void>((resolve) => {
      mediaLocked = resolve;
    });

    const attachment = prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`
        SELECT id FROM media_assets
        WHERE id = '55ed9830-d52d-47c4-8755-23522d940f53'
          AND deleted_at IS NULL
          AND storage_ready_at IS NOT NULL
        FOR KEY SHARE
      `);
      mediaLocked();
      await attachmentMayCommit;
      await tx.$executeRawUnsafe(`
        INSERT INTO articles (id, cover_media_id)
        VALUES (
          'a11ed983-d52d-47c4-8755-23522d940f53',
          '55ed9830-d52d-47c4-8755-23522d940f53'
        )
      `);
    });

    await mediaIsLocked;
    let deletionLockAcquired = false;
    const deletion = prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(`
        SELECT id FROM media_assets
        WHERE id = '55ed9830-d52d-47c4-8755-23522d940f53'
        FOR UPDATE
      `);
      deletionLockAcquired = true;
      const rows = await tx.$queryRawUnsafe<Array<{ total: bigint }>>(`
        SELECT COUNT(*) AS total FROM articles
        WHERE cover_media_id = '55ed9830-d52d-47c4-8755-23522d940f53'
      `);
      return Number(rows[0]?.total ?? 0n);
    });

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(deletionLockAcquired).toBe(false);
    releaseAttachment();

    await attachment;
    await expect(deletion).resolves.toBe(1);
  });
});
