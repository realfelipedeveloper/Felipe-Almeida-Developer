import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/json-ld';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getArticle, getArticles } from '@/lib/api/client';
import { formatDate, htmlToPlainText } from '@/lib/content';
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

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
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

export default async function ArticleDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const article = await getArticle(locale, slug);
  if (!article) notFound();
  const t = await getTranslations({ locale, namespace: 'articles' });
  const body = htmlToPlainText(article.bodyHtml);

  return (
    <main className="mx-auto max-w-4xl px-5 py-16 md:py-24">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: article.summary,
        datePublished: article.publishedAt ?? undefined,
        mainEntityOfPage: absoluteUrl(`/${locale}/artigos/${article.slug}`),
        author: { '@type': 'Person', name: 'Felipe Almeida' },
      }} />
      <Link href={`/${locale}/artigos`} className="text-sm font-bold text-slate-500">← {t('back')}</Link>
      {article.publishedAt ? <p className="mt-8 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{t('publishedAt', { date: formatDate(article.publishedAt, locale) ?? '' })}</p> : null}
      <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-slate-950 md:text-7xl dark:text-white">{article.title}</h1>
      <p className="mt-6 text-xl leading-9 text-slate-600 dark:text-slate-300">{article.summary}</p>
      <div className="mt-6 flex flex-wrap gap-2">{article.tags.map((tag) => <Tag key={tag.slug}>{tag.label}</Tag>)}</div>
      {article.readingTimeMinutes ? <p className="mt-5 text-sm text-slate-500">{t('readingTime', { minutes: article.readingTimeMinutes })}</p> : null}
      <article className="prose-safe mt-12 border-t border-slate-200 pt-10 text-lg text-slate-700 dark:border-slate-800 dark:text-slate-300">{body}</article>
    </main>
  );
}
