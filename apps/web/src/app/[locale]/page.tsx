import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ContentCard } from '@/components/content-card';
import { EmptyState } from '@/components/empty-state';
import { JsonLd } from '@/components/json-ld';
import { ProjectCard } from '@/components/project-card';
import { isLocale, type Locale } from '@/i18n/config';
import {
  getArticles,
  getNews,
  getProfile,
  getProjects,
} from '@/lib/api/client';
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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;

  const locale: Locale = rawLocale;

  const [
    tHero,
    tHome,
    tAvailability,
    tProjects,
    tArticles,
    tNews,
    tCommon,
  ] = await Promise.all([
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
  const headline = cleanSeedText(
    profile?.headline,
    tHero('fallbackHeadline'),
  );
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

      <section className="mx-auto grid min-h-[82vh] max-w-7xl items-center gap-14 px-5 py-16 md:grid-cols-[1.08fr_0.92fr] md:py-20">
        <div className="relative z-10">
          <p className="eyebrow">{tHero('eyebrow')}</p>

          <h1 className="display-title mt-6 max-w-4xl text-5xl sm:text-6xl md:text-[5.25rem]">
            <span className="text-gradient">{fullName}</span>
          </h1>

          <p className="mt-5 max-w-2xl text-xl font-semibold tracking-[-0.02em] text-zinc-700 dark:text-zinc-200">
            {headline}
          </p>

          <p className="mt-6 max-w-2xl text-base leading-8 text-zinc-600 md:text-lg dark:text-zinc-400">
            {summary}
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={`/${locale}/projetos`} className="btn-primary">
              {tHero('projects')}
              <span aria-hidden="true">↗</span>
            </Link>

            <Link href={`/${locale}/contato`} className="btn-secondary">
              {tHero('contact')}
            </Link>

            <Link
              href={`/${locale}/sobre`}
              className="section-link px-2 py-3"
            >
              {tHero('about')}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-9 inline-flex items-center gap-3 rounded-full border border-zinc-200 bg-white/50 px-4 py-2 text-xs dark:border-white/[0.08] dark:bg-white/[0.025]">
            <span
              className={`h-2 w-2 rounded-full ${
                profile?.availableForWork === false
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.65)]'
              }`}
            />
            <span className="font-semibold text-zinc-600 dark:text-zinc-300">
              {profile?.availableForWork === false
                ? tAvailability('unavailable')
                : tAvailability('available')}
            </span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md md:max-w-[29rem]">
          <div className="absolute -inset-8 rounded-[3rem] bg-zinc-400/10 blur-3xl dark:bg-zinc-400/[0.07]" />
          <div className="hero-photo">
            <Image
              src="/images/Eu.png"
              alt={fullName}
              width={1170}
              height={1560}
              priority
              className="aspect-[4/5] w-full object-cover object-top grayscale-[15%] contrast-[1.04]"
            />
          </div>

          <div className="hero-code">
            <div>
              <span className="code-dim">01</span>{' '}
              <span>const engineer = {'{'}</span>
            </div>
            <div>
              <span className="code-dim">02</span>{' '}
              <span>&nbsp;&nbsp;focus: &apos;software that lasts&apos;,</span>
            </div>
            <div>
              <span className="code-dim">03</span>{' '}
              <span>&nbsp;&nbsp;stack: &apos;context first&apos;,</span>
            </div>
            <div>
              <span className="code-dim">04</span>{' '}
              <span>&nbsp;&nbsp;status: &apos;shipping&apos;</span>
            </div>
            <div>
              <span className="code-dim">05</span> <span>{'}'};</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end">
            <div>
              <p className="eyebrow">{tHome('projectsEyebrow')}</p>
              <h2 className="section-heading mt-4">
                {tHome('projectsTitle')}
              </h2>
            </div>
            <div className="md:text-right">
              <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                {tHome('projectsText')}
              </p>
              <Link href={`/${locale}/projetos`} className="section-link mt-4">
                {tHome('seeAll')} <span>→</span>
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {projects.data.length ? (
              projects.data.map((project) => (
                <ProjectCard
                  key={project.id}
                  locale={locale}
                  project={project}
                  detailsLabel={tCommon('details')}
                  lifecycleLabel={tProjects(`lifecycle.${project.lifecycle}`)}
                />
              ))
            ) : (
              <div className="md:col-span-3">
                <EmptyState text={tHome('emptyProjects')} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <div className="site-panel overflow-hidden p-8 md:p-12">
            <div className="panel-glow" aria-hidden="true" />
            <div className="relative grid gap-8 md:grid-cols-[0.65fr_1.35fr] md:items-end">
              <p className="eyebrow">01 / PHILOSOPHY</p>
              <div>
                <h2 className="section-heading max-w-3xl">
                  {tHome('aboutTitle')}
                </h2>
                <p className="mt-5 max-w-3xl text-base leading-8 text-zinc-600 dark:text-zinc-400">
                  {tHome('aboutText')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <p className="eyebrow">{tHome('articlesEyebrow')}</p>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-heading">{tHome('articlesTitle')}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                {tHome('articlesText')}
              </p>
            </div>
            <Link href={`/${locale}/artigos`} className="section-link">
              {tHome('seeAll')} <span>→</span>
            </Link>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {articles.data.length ? (
              articles.data.map((article) => (
                <ContentCard
                  key={article.id}
                  locale={locale}
                  hrefBase="artigos"
                  title={article.title}
                  slug={article.slug}
                  summary={article.summary}
                  tags={article.tags}
                  meta={
                    article.publishedAt
                      ? tArticles('publishedAt', {
                          date:
                            formatDate(article.publishedAt, locale) ?? '',
                        })
                      : null
                  }
                  readMore={tCommon('readMore')}
                />
              ))
            ) : (
              <div className="md:col-span-3">
                <EmptyState text={tHome('emptyArticles')} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <p className="eyebrow">{tHome('newsEyebrow')}</p>

          <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="section-heading">{tHome('newsTitle')}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                {tHome('newsText')}
              </p>
            </div>
            <Link href={`/${locale}/noticias`} className="section-link">
              {tHome('seeAll')} <span>→</span>
            </Link>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {news.data.length ? (
              news.data.map((item) => (
                <ContentCard
                  key={item.id}
                  locale={locale}
                  hrefBase="noticias"
                  title={item.title}
                  slug={item.slug}
                  summary={item.summary}
                  tags={item.tags}
                  meta={
                    item.publishedAt
                      ? tNews('publishedAt', {
                          date: formatDate(item.publishedAt, locale) ?? '',
                        })
                      : null
                  }
                  readMore={tCommon('readMore')}
                />
              ))
            ) : (
              <div className="md:col-span-3">
                <EmptyState text={tHome('emptyNews')} />
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20">
        <div className="site-panel relative overflow-hidden p-8 md:p-12">
          <div className="panel-glow" aria-hidden="true" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">SIGNAL / NO NOISE</p>
              <h2 className="section-heading mt-4">
                {tHome('newsletterTitle')}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                {tHome('newsletterText')}
              </p>
            </div>

            <Link href={`/${locale}/newsletter`} className="btn-primary shrink-0">
              {tHome('newsletterCta')} <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
