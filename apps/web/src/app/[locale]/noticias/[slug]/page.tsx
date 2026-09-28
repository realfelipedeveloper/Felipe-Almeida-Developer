import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getNews, getNewsItem } from '@/lib/api/client';
import { formatDate, htmlToPlainText } from '@/lib/content';
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
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

export default async function NewsDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const item = await getNewsItem(locale, slug);
  if (!item) notFound();
  const t = await getTranslations({ locale, namespace: 'news' });

  return (
    <main className="mx-auto max-w-4xl px-5 py-16 md:py-24">
      <Link href={`/${locale}/noticias`} className="text-sm font-bold text-slate-500">← {t('back')}</Link>
      {item.publishedAt ? <p className="mt-8 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{t('publishedAt', { date: formatDate(item.publishedAt, locale) ?? '' })}</p> : null}
      <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-slate-950 md:text-7xl dark:text-white">{item.title}</h1>
      <p className="mt-6 text-xl leading-9 text-slate-600 dark:text-slate-300">{item.summary}</p>
      <div className="mt-6 flex flex-wrap gap-2">{item.tags.map((tag) => <Tag key={tag.slug}>{tag.label}</Tag>)}</div>
      <article className="prose-safe mt-12 border-t border-slate-200 pt-10 text-lg text-slate-700 dark:border-slate-800 dark:text-slate-300">{htmlToPlainText(item.contentHtml)}</article>
    </main>
  );
}
