import { PrismaClient, type Locale } from '@prisma/client';
import Redis from 'ioredis';
import { DomPurifyRichTextSanitizer } from './dom-purify-rich-text-sanitizer';

type RichTextChange = {
  kind: 'article' | 'news';
  id: string;
  locale: Locale;
  original: string;
  sanitized: string;
  empty: boolean;
};

const prisma = new PrismaClient();
const sanitizer = new DomPurifyRichTextSanitizer();

async function invalidatePrefix(redis: Redis, prefix: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) await redis.del(...keys);
  } while (cursor !== '0');
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const [articles, news] = await Promise.all([
    prisma.articleTranslation.findMany({
      select: { id: true, locale: true, bodyHtml: true },
    }),
    prisma.newsTranslation.findMany({
      select: { id: true, locale: true, contentHtml: true },
    }),
  ]);

  const audited: RichTextChange[] = [
    ...articles.map((row) => {
      const sanitized = sanitizer.sanitize(row.bodyHtml);
      return {
        kind: 'article' as const,
        id: row.id,
        locale: row.locale,
        original: row.bodyHtml,
        sanitized,
        empty: !sanitizer.hasMeaningfulContent(sanitized),
      };
    }),
    ...news.map((row) => {
      const sanitized = sanitizer.sanitize(row.contentHtml);
      return {
        kind: 'news' as const,
        id: row.id,
        locale: row.locale,
        original: row.contentHtml,
        sanitized,
        empty: !sanitizer.hasMeaningfulContent(sanitized),
      };
    }),
  ];

  const changes = audited.filter((item) => item.original !== item.sanitized);
  const empty = audited.filter((item) => item.empty).length;
  console.log(
    JSON.stringify({
      mode: apply ? 'apply' : 'dry-run',
      scanned: articles.length + news.length,
      changed: changes.length,
      empty,
    }),
  );

  if (!apply) {
    if (changes.length > 0) process.exitCode = 2;
    return;
  }

  if (
    process.env.RICH_TEXT_BACKUP_CONFIRMED !== 'true' ||
    process.env.RICH_TEXT_SANITIZE_CONFIRM !== 'SANITIZE_RICH_TEXT'
  ) {
    throw new Error(
      'Aplicação recusada: confirme backup e operação pelas variáveis RICH_TEXT_BACKUP_CONFIRMED e RICH_TEXT_SANITIZE_CONFIRM.',
    );
  }

  if (empty > 0) {
    throw new Error(
      'Aplicação recusada: há conteúdo que ficaria vazio e exige correção editorial manual.',
    );
  }

  const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  try {
    await redis.connect();
    await redis.ping();

    for (let offset = 0; offset < changes.length; offset += 100) {
      const batch = changes.slice(offset, offset + 100);
      await prisma.$transaction(
        batch.map((item) =>
          item.kind === 'article'
            ? prisma.articleTranslation.update({
                where: { id: item.id },
                data: { bodyHtml: item.sanitized },
              })
            : prisma.newsTranslation.update({
                where: { id: item.id },
                data: { contentHtml: item.sanitized },
              }),
        ),
      );
    }

    await invalidatePrefix(redis, 'public:articles:');
    await invalidatePrefix(redis, 'public:news:');
  } finally {
    await redis.quit().catch(() => undefined);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Falha desconhecida na auditoria.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
