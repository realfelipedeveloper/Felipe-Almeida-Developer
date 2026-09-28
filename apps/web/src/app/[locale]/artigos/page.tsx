import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { PageHero } from '@/components/page-hero';
import { Pagination } from '@/components/pagination';
import { isLocale, type Locale } from '@/i18n/config';
import { getArticles } from '@/lib/api/client';
import { formatDate } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('articlesTitle'), description: t('siteDescription'), path: 'artigos' });
}

export default async function ArticlesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale: Locale = rawLocale;
  const query = await searchParams;
  const t = await getTranslations({ locale, namespace: 'articles' });
  const common = await getTranslations({ locale, namespace: 'common' });

  const page = Math.max(1, Number(value(query.page) ?? 1) || 1);
  const tag = value(query.tag);
  const result = await getArticles({ locale, page, limit: 12, tag });

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <form action={`/${locale}/artigos`} className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:flex-row md:items-end dark:border-slate-800 dark:bg-slate-900/60">
          <label className="flex-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {t('filterTag')}
            <input name="tag" defaultValue={tag} placeholder="clean-code" className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm normal-case tracking-normal dark:border-slate-700" />
          </label>
          <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{t('filterApply')}</button>
          <Link href={`/${locale}/artigos`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-center text-sm font-bold dark:border-slate-700">{t('filterClear')}</Link>
        </form>
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {result.data.length ? result.data.map((article) => (
            <ContentCard
              key={article.id}
              locale={locale}
              hrefBase="artigos"
              title={article.title}
              slug={article.slug}
              summary={article.summary}
              tags={article.tags}
              meta={article.publishedAt ? t('publishedAt', { date: formatDate(article.publishedAt, locale) ?? '' }) : null}
              readMore={common('readMore')}
            />
          )) : <div className="md:col-span-2 xl:col-span-3"><EmptyState text={t('empty')} /></div>}
        </div>
        <Pagination
          path={`/${locale}/artigos`}
          page={result.pagination.page}
          totalPages={result.pagination.totalPages}
          params={{ tag }}
          previousLabel={common('previous')}
          nextLabel={common('next')}
          pageLabel={common('page', { page: result.pagination.page, total: Math.max(result.pagination.totalPages, 1) })}
        />
      </section>
    </main>
  );
}
