import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/json-ld';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getProject, getProjects } from '@/lib/api/client';
import { formatDate, safeExternalUrl } from '@/lib/content';
import { absoluteUrl, pageMetadata } from '@/lib/seo';

async function languagePaths(projectId: string) {
  const entries = await Promise.all(
    locales.map(async (locale) => {
      const items = await getProjects({ locale, page: 1, limit: 50 });
      const item = items.data.find((project) => project.id === projectId);
      return item ? ([locale, `projetos/${item.slug}`] as const) : null;
    }),
  );
  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [Locale, string]>);
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const project = await getProject(locale, slug);
  if (!project) return {};
  return pageMetadata({
    locale,
    title: project.title,
    description: project.summary,
    path: `projetos/${slug}`,
    languagePaths: await languagePaths(project.id),
  });
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const project = await getProject(locale, slug);
  if (!project) notFound();

  const t = await getTranslations({ locale, namespace: 'projects' });
  const repositoryUrl = safeExternalUrl(project.repositoryUrl);
  const demoUrl = safeExternalUrl(project.demoUrl);

  return (
    <main className="mx-auto max-w-5xl px-5 py-16 md:py-24">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'CreativeWork',
        name: project.title,
        description: project.summary,
        url: absoluteUrl(`/${locale}/projetos/${project.slug}`),
        datePublished: project.publishedAt ?? undefined,
        keywords: [...project.technologies.map((item) => item.name), ...project.tags.map((item) => item.label)],
      }} />

      <Link href={`/${locale}/projetos`} className="text-sm font-bold text-slate-500">← {t('eyebrow')}</Link>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-bold dark:border-slate-700">{t(`lifecycle.${project.lifecycle}`)}</span>
        {project.featured ? <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">{t('featured')}</span> : null}
      </div>
      <h1 className="mt-5 text-5xl font-black tracking-[-0.05em] text-slate-950 md:text-7xl dark:text-white">{project.title}</h1>
      <p className="mt-6 text-xl leading-9 text-slate-600 dark:text-slate-300">{project.summary}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        {repositoryUrl ? <a href={repositoryUrl} target="_blank" rel="noreferrer" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white dark:bg-white dark:text-slate-950">{t('repository')} ↗</a> : null}
        {demoUrl ? <a href={demoUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold dark:border-slate-700">{t('demo')} ↗</a> : null}
      </div>

      <div className="mt-12 grid gap-8 border-y border-slate-200 py-8 md:grid-cols-2 dark:border-slate-800">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{t('technologies')}</p>
          <div className="mt-3 flex flex-wrap gap-2">{project.technologies.map((item) => <Tag key={item.slug}>{item.name}</Tag>)}</div>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">{t('tags')}</p>
          <div className="mt-3 flex flex-wrap gap-2">{project.tags.map((item) => <Tag key={item.slug}>{item.label}</Tag>)}</div>
        </div>
      </div>

      <section className="prose-safe mt-12 text-lg text-slate-600 dark:text-slate-300">{project.description}</section>

      <div className="mt-12 grid gap-5">
        {project.challenges ? <section className="rounded-3xl border border-slate-200 p-6 dark:border-slate-800"><h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('challenge')}</h2><p className="mt-4 whitespace-pre-wrap leading-8 text-slate-600 dark:text-slate-300">{project.challenges}</p></section> : null}
        {project.solution ? <section className="rounded-3xl border border-slate-200 p-6 dark:border-slate-800"><h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('solution')}</h2><p className="mt-4 whitespace-pre-wrap leading-8 text-slate-600 dark:text-slate-300">{project.solution}</p></section> : null}
        {project.results ? <section className="rounded-3xl border border-slate-200 p-6 dark:border-slate-800"><h2 className="text-2xl font-black text-slate-950 dark:text-white">{t('results')}</h2><p className="mt-4 whitespace-pre-wrap leading-8 text-slate-600 dark:text-slate-300">{project.results}</p></section> : null}
      </div>

      {(project.startedAt || project.endedAt) ? (
        <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-500 dark:text-slate-400">
          {project.startedAt ? <span><strong>{t('started')}:</strong> {formatDate(project.startedAt, locale)}</span> : null}
          {project.endedAt ? <span><strong>{t('ended')}:</strong> {formatDate(project.endedAt, locale)}</span> : null}
        </div>
      ) : null}
    </main>
  );
}
