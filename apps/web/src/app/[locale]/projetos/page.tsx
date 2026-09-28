import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { EmptyState } from '@/components/empty-state';
import { PageHero } from '@/components/page-hero';
import { Pagination } from '@/components/pagination';
import { ProjectCard } from '@/components/project-card';
import { isLocale, type Locale } from '@/i18n/config';
import { getProjects } from '@/lib/api/client';
import type { ProjectLifecycle } from '@/lib/api/types';
import { pageMetadata } from '@/lib/seo';

const lifecycles: ProjectLifecycle[] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'MAINTENANCE', 'ARCHIVED'];

function value(input: string | string[] | undefined) {
  return Array.isArray(input) ? input[0] : input;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('projectsTitle'), description: t('siteDescription'), path: 'projetos' });
}

export default async function ProjectsPage({
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
  const t = await getTranslations({ locale, namespace: 'projects' });
  const common = await getTranslations({ locale, namespace: 'common' });

  const lifecycleRaw = value(query.lifecycle);
  const lifecycle = lifecycles.includes(lifecycleRaw as ProjectLifecycle) ? (lifecycleRaw as ProjectLifecycle) : undefined;
  const page = Math.max(1, Number(value(query.page) ?? 1) || 1);
  const technology = value(query.technology);
  const tag = value(query.tag);
  const featured = value(query.featured) === 'true';

  const result = await getProjects({ locale, page, limit: 12, lifecycle, technology, tag, featured: featured || undefined });

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto max-w-7xl px-5 pb-20">
        <form action={`/${locale}/projetos`} className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-5 md:grid-cols-[1fr_1fr_1fr_auto_auto] dark:border-slate-800 dark:bg-slate-900/60">
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {t('filterTechnology')}
            <input name="technology" defaultValue={technology} placeholder="node-js" className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm normal-case tracking-normal dark:border-slate-700" />
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {t('filterTag')}
            <input name="tag" defaultValue={tag} placeholder="arquitetura" className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm normal-case tracking-normal dark:border-slate-700" />
          </label>
          <label className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
            {t('filterLifecycle')}
            <select name="lifecycle" defaultValue={lifecycle ?? ''} className="mt-2 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2.5 text-sm normal-case tracking-normal dark:border-slate-700 dark:bg-slate-900">
              <option value="">{t('filterAll')}</option>
              {lifecycles.map((item) => <option key={item} value={item}>{t(`lifecycle.${item}`)}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-semibold">
            <input type="checkbox" name="featured" value="true" defaultChecked={featured} />
            {t('filterFeatured')}
          </label>
          <div className="flex items-end gap-2">
            <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{t('filterApply')}</button>
            <Link href={`/${locale}/projetos`} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold dark:border-slate-700">{t('filterClear')}</Link>
          </div>
        </form>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {result.data.length ? result.data.map((project) => (
            <ProjectCard key={project.id} locale={locale} project={project} detailsLabel={common('details')} lifecycleLabel={t(`lifecycle.${project.lifecycle}`)} />
          )) : <div className="md:col-span-2 xl:col-span-3"><EmptyState text={t('empty')} /></div>}
        </div>

        <Pagination
          path={`/${locale}/projetos`}
          page={result.pagination.page}
          totalPages={result.pagination.totalPages}
          params={{ technology, tag, lifecycle, featured: featured ? 'true' : undefined }}
          previousLabel={common('previous')}
          nextLabel={common('next')}
          pageLabel={common('page', { page: result.pagination.page, total: Math.max(result.pagination.totalPages, 1) })}
        />
      </section>
    </main>
  );
}
