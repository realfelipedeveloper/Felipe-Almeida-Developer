import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { JsonLd } from '@/components/json-ld';
import { ProjectCard } from '@/components/project-card';
import { isLocale, type Locale } from '@/i18n/config';
import { getArticles, getNews, getProfile, getProjects } from '@/lib/api/client';
import { cleanSeedText, formatDate } from '@/lib/content';
import { absoluteUrl, pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return {};
  const t = await getTranslations({ locale: rawLocale, namespace: 'meta' });
  return pageMetadata({
    locale: rawLocale,
    title: t('homeTitle'),
    description: t('siteDescription'),
  });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale: Locale = rawLocale;

  const [tHero, tHome, tAvailability, tProjects, tArticles, tNews, tCommon] = await Promise.all([
    getTranslations({ locale, namespace: 'hero' }),
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'availability' }),
    getTranslations({ locale, namespace: 'projects' }),
    getTranslations({ locale, namespace: 'articles' }),
    getTranslations({ locale, namespace: 'news' }),
    getTranslations({ locale, namespace: 'common' }),
  ]);

  const [profile, projects, articles, news] = await Promise.all([
    getProfile(locale),
    getProjects({ locale, page: 1, limit: 3, featured: true }),
    getArticles({ locale, page: 1, limit: 3 }),
    getNews({ locale, page: 1, limit: 3 }),
  ]);

  const fullName = cleanSeedText(profile?.fullName, tHero('fallbackTitle'));
  const headline = cleanSeedText(profile?.headline, tHero('fallbackHeadline'));
  const summary = cleanSeedText(profile?.summary, tHero('fallbackSummary'));

  return (
    <main>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: fullName,
          jobTitle: headline,
          description: summary,
          url: absoluteUrl(`/${locale}`),
          image: absoluteUrl('/images/Eu.png'),
          sameAs: profile?.socialLinks.map((link) => link.url) ?? [],
        }}
      />

      <section className="mx-auto grid min-h-[78vh] max-w-7xl items-center gap-12 px-5 py-14 md:grid-cols-[1.15fr_0.85fr] md:py-20">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">{tHero('eyebrow')}</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-black tracking-[-0.055em] text-slate-950 md:text-7xl dark:text-white">
            {fullName}
          </h1>
          <p className="mt-4 text-xl font-bold text-slate-700 dark:text-slate-200">{headline}</p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">{summary}</p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/${locale}/projetos`} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 dark:bg-white dark:text-slate-950">
              {tHero('projects')}
            </Link>
            <Link href={`/${locale}/contato`} className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-900">
              {tHero('contact')}
            </Link>
            <Link href={`/${locale}/sobre`} className="px-2 py-3 text-sm font-bold text-slate-600 dark:text-slate-300">
              {tHero('about')} →
            </Link>
          </div>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${profile?.availableForWork === false ? 'bg-amber-500' : 'bg-emerald-500'}`} />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {profile?.availableForWork === false ? tAvailability('unavailable') : tAvailability('available')}
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-slate-300/40 to-slate-600/10 blur-2xl dark:from-slate-600/25 dark:to-slate-900/20" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-slate-200 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <Image src="/images/Eu.png" alt={fullName} width={1170} height={1560} priority className="aspect-[4/5] w-full object-cover object-top" />
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/45 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-24">
          <div className="grid gap-8 md:grid-cols-[0.7fr_1.3fr] md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{tHome('projectsEyebrow')}</p>
              <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{tHome('projectsTitle')}</h2>
            </div>
            <div className="md:text-right">
              <p className="text-slate-600 dark:text-slate-300">{tHome('projectsText')}</p>
              <Link href={`/${locale}/projetos`} className="mt-3 inline-block text-sm font-bold">{tHome('seeAll')} →</Link>
            </div>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {projects.data.length ? projects.data.map((project) => (
              <ProjectCard
                key={project.id}
                locale={locale}
                project={project}
                detailsLabel={tCommon('details')}
                lifecycleLabel={tProjects(`lifecycle.${project.lifecycle}`)}
              />
            )) : <div className="md:col-span-3"><EmptyState text={tHome('emptyProjects')} /></div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:py-24">
        <div className="max-w-3xl">
          <h2 className="text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{tHome('aboutTitle')}</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">{tHome('aboutText')}</p>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/45 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{tHome('articlesEyebrow')}</p>
          <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{tHome('articlesTitle')}</h2>
              <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{tHome('articlesText')}</p>
            </div>
            <Link href={`/${locale}/artigos`} className="text-sm font-bold">{tHome('seeAll')} →</Link>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {articles.data.length ? articles.data.map((article) => (
              <ContentCard
                key={article.id}
                locale={locale}
                hrefBase="artigos"
                title={article.title}
                slug={article.slug}
                summary={article.summary}
                tags={article.tags}
                meta={article.publishedAt ? tArticles('publishedAt', { date: formatDate(article.publishedAt, locale) ?? '' }) : null}
                readMore={tCommon('readMore')}
              />
            )) : <div className="md:col-span-3"><EmptyState text={tHome('emptyArticles')} /></div>}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:py-24">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{tHome('newsEyebrow')}</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">{tHome('newsTitle')}</h2>
            <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{tHome('newsText')}</p>
          </div>
          <Link href={`/${locale}/noticias`} className="text-sm font-bold">{tHome('seeAll')} →</Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {news.data.length ? news.data.map((item) => (
            <ContentCard
              key={item.id}
              locale={locale}
              hrefBase="noticias"
              title={item.title}
              slug={item.slug}
              summary={item.summary}
              tags={item.tags}
              meta={item.publishedAt ? tNews('publishedAt', { date: formatDate(item.publishedAt, locale) ?? '' }) : null}
              readMore={tCommon('readMore')}
            />
          )) : <div className="md:col-span-3"><EmptyState text={tHome('emptyNews')} /></div>}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20">
        <div className="rounded-[2rem] bg-slate-950 p-8 text-white md:p-12 dark:border dark:border-slate-800">
          <h2 className="text-3xl font-black tracking-[-0.035em] md:text-4xl">{tHome('newsletterTitle')}</h2>
          <p className="mt-4 max-w-2xl leading-7 text-slate-300">{tHome('newsletterText')}</p>
          <Link href={`/${locale}/newsletter`} className="mt-7 inline-block rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950">
            {tHome('newsletterCta')} →
          </Link>
        </div>
      </section>
    </main>
  );
}
