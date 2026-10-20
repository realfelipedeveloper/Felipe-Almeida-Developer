import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/json-ld';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getArticle, getArticles } from '@/lib/api/client';
import { formatDate, htmlToPlainText, mediaUrl } from '@/lib/content';
import { absoluteUrl, pageMetadata } from '@/lib/seo';

async function languagePaths(articleId: string) {
  const entries = await Promise.all(
    locales.map(async (locale) => {
      const items = await getArticles({ locale, page: 1, limit: 50 });
      const item = items.data.find((article) => article.id === articleId);
      return item ? ([locale, `artigos/${item.slug}`] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [Locale, string]>);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const article = await getArticle(locale, slug);
  if (!article) return {};
  return pageMetadata({
    locale,
    title: article.title,
    description: article.summary,
    path: `artigos/${slug}`,
    languagePaths: await languagePaths(article.id),
  });
}

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const article = await getArticle(locale, slug);
  if (!article) notFound();
  const t = await getTranslations({ locale, namespace: 'articles' });
  const body = htmlToPlainText(article.bodyHtml);

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.summary,
          datePublished: article.publishedAt ?? undefined,
          mainEntityOfPage: absoluteUrl(`/${locale}/artigos/${article.slug}`),
          author: { '@type': 'Person', name: 'Felipe Almeida' },
        }}
      />
      <Link href={`/${locale}/artigos`} className="btn-ghost -ml-3 min-h-0 px-3 py-2">
        ← {t('back')}
      </Link>
      {article.publishedAt ? (
        <p className="eyebrow mt-10">
          {t('publishedAt', { date: formatDate(article.publishedAt, locale) ?? '' })}
        </p>
      ) : null}
      <h1 className="page-hero-title mt-7 text-[clamp(3.5rem,8vw,7rem)]">{article.title}</h1>
      <p className="mt-8 max-w-4xl text-xl leading-9 text-[var(--muted)] md:text-2xl">
        {article.summary}
      </p>
      {article.coverMediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(article.coverMediaId) ?? undefined}
          alt=""
          className="mt-12 max-h-[38rem] w-full rounded-[2rem] border border-[var(--border)] object-cover shadow-[var(--shadow)]"
        />
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {article.tags.map((tag) => (
          <Tag key={tag.slug}>{tag.label}</Tag>
        ))}
      </div>
      {article.readingTimeMinutes ? (
        <p className="mt-5 font-mono text-xs text-[var(--subtle)]">
          {t('readingTime', { minutes: article.readingTimeMinutes })}
        </p>
      ) : null}
      <article className="prose-safe mx-auto mt-14 max-w-4xl border-t border-[var(--border)] pt-12 text-lg text-[var(--muted)] md:text-xl">
        {body}
      </article>
    </main>
  );
}
