import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getNews, getNewsItem } from '@/lib/api/client';
import { formatDate, htmlToPlainText, mediaUrl } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

async function languagePaths(newsId: string) {
  const entries = await Promise.all(
    locales.map(async (locale) => {
      const items = await getNews({ locale, page: 1, limit: 50 });
      const item = items.data.find((news) => news.id === newsId);
      return item ? ([locale, `noticias/${item.slug}`] as const) : null;
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
  const item = await getNewsItem(locale, slug);
  if (!item) return {};
  return pageMetadata({
    locale,
    title: item.title,
    description: item.summary,
    path: `noticias/${slug}`,
    languagePaths: await languagePaths(item.id),
  });
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const item = await getNewsItem(locale, slug);
  if (!item) notFound();
  const t = await getTranslations({ locale, namespace: 'news' });

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <Link href={`/${locale}/noticias`} className="btn-ghost -ml-3 min-h-0 px-3 py-2">
        ← {t('back')}
      </Link>
      {item.publishedAt ? (
        <p className="eyebrow mt-10">
          {t('publishedAt', { date: formatDate(item.publishedAt, locale) ?? '' })}
        </p>
      ) : null}
      <h1 className="page-hero-title mt-7 text-[clamp(3.5rem,8vw,7rem)]">{item.title}</h1>
      <p className="mt-8 max-w-4xl text-xl leading-9 text-[var(--muted)] md:text-2xl">
        {item.summary}
      </p>
      {item.coverMediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(item.coverMediaId) ?? undefined}
          alt=""
          className="mt-12 max-h-[38rem] w-full rounded-[2rem] border border-[var(--border)] object-cover shadow-[var(--shadow)]"
        />
      ) : null}
      <div className="mt-6 flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <Tag key={tag.slug}>{tag.label}</Tag>
        ))}
      </div>
      <article className="prose-safe mx-auto mt-14 max-w-4xl border-t border-[var(--border)] pt-12 text-lg text-[var(--muted)] md:text-xl">
        {htmlToPlainText(item.contentHtml)}
      </article>
    </main>
  );
}
