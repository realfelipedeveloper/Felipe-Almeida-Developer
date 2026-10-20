import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { JsonLd } from '@/components/json-ld';
import { Tag } from '@/components/tag';
import { isLocale, locales, type Locale } from '@/i18n/config';
import { getProject, getProjects } from '@/lib/api/client';
import { formatDate, mediaUrl, safeExternalUrl } from '@/lib/content';
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
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

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!isLocale(rawLocale)) notFound();
  const locale: Locale = rawLocale;
  const project = await getProject(locale, slug);
  if (!project) notFound();

  const t = await getTranslations({ locale, namespace: 'projects' });
  const repositoryUrl = safeExternalUrl(project.repositoryUrl);
  const demoUrl = safeExternalUrl(project.demoUrl);

  return (
    <main className="mx-auto max-w-6xl px-5 py-16 md:py-24">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: project.title,
          description: project.summary,
          url: absoluteUrl(`/${locale}/projetos/${project.slug}`),
          datePublished: project.publishedAt ?? undefined,
          keywords: [
            ...project.technologies.map((item) => item.name),
            ...project.tags.map((item) => item.label),
          ],
        }}
      />

      <Link href={`/${locale}/projetos`} className="btn-ghost -ml-3 min-h-0 px-3 py-2">
        ← {t('eyebrow')}
      </Link>
      <div className="mt-10 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]">
          {t(`lifecycle.${project.lifecycle}`)}
        </span>
        {project.featured ? (
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-300">
            {t('featured')}
          </span>
        ) : null}
      </div>
      <h1 className="page-hero-title mt-7 max-w-5xl text-[clamp(3.5rem,8vw,7rem)]">
        {project.title}
      </h1>
      <p className="mt-8 max-w-4xl text-xl leading-9 text-[var(--muted)] md:text-2xl">
        {project.summary}
      </p>

      {project.coverMediaId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={mediaUrl(project.coverMediaId) ?? undefined}
          alt=""
          className="mt-12 max-h-[42rem] w-full rounded-[2rem] border border-[var(--border)] object-cover shadow-[var(--shadow)]"
        />
      ) : null}

      <div className="mt-8 flex flex-wrap gap-3">
        {repositoryUrl ? (
          <a href={repositoryUrl} target="_blank" rel="noreferrer" className="btn-primary">
            {t('repository')} ↗
          </a>
        ) : null}
        {demoUrl ? (
          <a href={demoUrl} target="_blank" rel="noreferrer" className="btn-secondary">
            {t('demo')} ↗
          </a>
        ) : null}
      </div>

      <div className="site-panel mt-12 grid gap-8 p-7 md:grid-cols-2 md:p-9">
        <div>
          <p className="eyebrow">{t('technologies')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.technologies.map((item) => (
              <Tag key={item.slug}>{item.name}</Tag>
            ))}
          </div>
        </div>
        <div>
          <p className="eyebrow">{t('tags')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {project.tags.map((item) => (
              <Tag key={item.slug}>{item.label}</Tag>
            ))}
          </div>
        </div>
      </div>

      <section className="prose-safe mx-auto mt-16 max-w-4xl text-lg text-[var(--muted)] md:text-xl">
        {project.description}
      </section>

      <div className="mt-12 grid gap-5">
        {project.challenges ? (
          <section className="site-panel p-7 md:p-9">
            <p className="eyebrow">01</p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-[var(--text)]">
              {t('challenge')}
            </h2>
            <p className="mt-4 whitespace-pre-wrap leading-8 text-[var(--muted)]">
              {project.challenges}
            </p>
          </section>
        ) : null}
        {project.solution ? (
          <section className="site-panel p-7 md:p-9">
            <p className="eyebrow">02</p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-[var(--text)]">
              {t('solution')}
            </h2>
            <p className="mt-4 whitespace-pre-wrap leading-8 text-[var(--muted)]">
              {project.solution}
            </p>
          </section>
        ) : null}
        {project.results ? (
          <section className="site-panel p-7 md:p-9">
            <p className="eyebrow">03</p>
            <h2 className="mt-5 text-3xl font-bold tracking-[-0.045em] text-[var(--text)]">
              {t('results')}
            </h2>
            <p className="mt-4 whitespace-pre-wrap leading-8 text-[var(--muted)]">
              {project.results}
            </p>
          </section>
        ) : null}
      </div>

      {project.galleryMediaIds.length ? (
        <section className="mt-12">
          <h2 className="section-heading text-[clamp(2rem,4vw,3.5rem)]">{t('gallery')}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {project.galleryMediaIds.map((mediaId) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={mediaId}
                src={mediaUrl(mediaId) ?? undefined}
                alt=""
                className="h-72 w-full rounded-2xl border border-[var(--border)] object-cover shadow-[var(--shadow-soft)]"
              />
            ))}
          </div>
        </section>
      ) : null}

      {project.startedAt || project.endedAt ? (
        <div className="mt-10 flex flex-wrap gap-6 border-t border-[var(--border)] pt-6 text-sm text-[var(--muted)]">
          {project.startedAt ? (
            <span>
              <strong>{t('started')}:</strong> {formatDate(project.startedAt, locale)}
            </span>
          ) : null}
          {project.endedAt ? (
            <span>
              <strong>{t('ended')}:</strong> {formatDate(project.endedAt, locale)}
            </span>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
