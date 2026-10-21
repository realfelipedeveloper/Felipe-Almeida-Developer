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
import { cleanSeedText, formatDate, mediaUrl } from '@/lib/content';
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
    <main className="immersive-home overflow-hidden">
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: fullName,
          jobTitle: headline,
          description: summary,
          url: absoluteUrl(`/${locale}`),
          image: profile?.avatarMediaId
            ? mediaUrl(profile.avatarMediaId)
            : absoluteUrl('/images/Eu.png'),
          sameAs: profile?.socialLinks.map((link) => link.url) ?? [],
        }}
      />

      <section
        data-ui="home-hero"
        className="home-hero-cinematic mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-14 px-5 py-16 lg:grid-cols-[1.08fr_0.92fr] lg:py-20"
      >
        <div className="relative z-10" data-reveal>
          <p className="eyebrow">{tHero('eyebrow')}</p>

          <h1 className="display-title mt-7 max-w-4xl text-[clamp(3.7rem,9vw,7.6rem)]">
            <span className="text-gradient">{fullName}</span>
          </h1>

          <p className="mt-6 max-w-2xl text-xl font-semibold tracking-[-0.025em] text-[var(--text)] md:text-2xl">
            {headline}
          </p>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted)] md:text-lg">
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

            <Link href={`/${locale}/sobre`} className="section-link px-2 py-3">
              {tHero('about')}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2.5 text-xs backdrop-blur-lg">
            <span
              className={`h-2 w-2 rounded-full ${
                profile?.availableForWork === false
                  ? 'bg-amber-400'
                  : 'bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.65)]'
              }`}
            />
            <span className="font-semibold text-[var(--muted)]">
              {profile?.availableForWork === false
                ? tAvailability('unavailable')
                : tAvailability('available')}
            </span>
          </div>

          <div className="mt-9 grid max-w-2xl grid-cols-3 gap-4 border-t border-[var(--border)] pt-6">
            <div className="hero-stat">
              <strong>{tHome('statFullStack')}</strong>
              <span>{tHome('statFullStackText')}</span>
            </div>
            <div className="hero-stat">
              <strong>{tHome('statArchitecture')}</strong>
              <span>{tHome('statArchitectureText')}</span>
            </div>
            <div className="hero-stat">
              <strong>{tHome('statQuality')}</strong>
              <span>{tHome('statQualityText')}</span>
            </div>
          </div>
        </div>

        <div
          className="hero-visual relative mx-auto w-full max-w-md lg:max-w-[30rem]"
          data-reveal
          data-tilt
        >
          <div className="hero-orbit" aria-hidden="true" />
          <div className="absolute -inset-8 rounded-[3rem] bg-[var(--accent-soft)] blur-3xl" />
          <div className="hero-photo">
            {profile?.avatarMediaId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={mediaUrl(profile.avatarMediaId) ?? undefined}
                alt={fullName}
                className="aspect-[4/5] w-full object-cover object-top grayscale-[15%] contrast-[1.04]"
              />
            ) : (
              <Image
                src="/images/Eu.png"
                alt={fullName}
                width={1170}
                height={1560}
                priority
                className="aspect-[4/5] w-full object-cover object-top grayscale-[15%] contrast-[1.04]"
              />
            )}
          </div>

          <div className="hero-code">
            <div className="mb-1 flex items-center gap-2 border-b border-white/10 pb-2">
              <span className="h-2 w-2 rounded-full bg-rose-400" />
              <span className="h-2 w-2 rounded-full bg-amber-300" />
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
            </div>
            <div>
              <span className="code-dim">01</span> <span>const engineer = {'{'}</span>
            </div>
            <div>
              <span className="code-dim">02</span>{' '}
              <span>
                &nbsp;&nbsp;focus:{' '}
                <span className="code-accent">&apos;software that lasts&apos;</span>,
              </span>
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

      <div className="kinetic-band" aria-hidden="true">
        <div className="kinetic-track">
          {[0, 1].map((group) => (
            <div className="kinetic-group" key={group}>
              <span>{headline}</span>
              <i>✦</i>
              <span>{fullName}</span>
              <i>✦</i>
              <span>{tHero('eyebrow')}</span>
              <i>✦</i>
            </div>
          ))}
        </div>
      </div>

      <section className="section-shell" data-ui="featured-work">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-end" data-reveal>
            <div>
              <p className="eyebrow">{tHome('projectsEyebrow')}</p>
              <h2 className="section-heading mt-4">{tHome('projectsTitle')}</h2>
            </div>
            <div className="md:text-right">
              <p className="text-sm leading-7 text-[var(--muted)]">{tHome('projectsText')}</p>
              <Link href={`/${locale}/projetos`} className="section-link mt-4">
                {tHome('seeAll')} <span>→</span>
              </Link>
            </div>
          </div>

          <div className="grid-auto-fit mt-10 grid gap-5">
            {projects.data.length ? (
              projects.data.map((project) => (
                <ProjectCard
                  key={project.id}
                  locale={locale}
                  project={project}
                  detailsLabel={tCommon('details')}
                  lifecycleLabel={tProjects(`lifecycle.${project.lifecycle}`)}
                  featuredLabel={tProjects('featured')}
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
          <div
            className="site-panel statement-panel overflow-hidden p-8 md:p-12 lg:p-16"
            data-reveal
            data-tilt
          >
            <div className="panel-glow" aria-hidden="true" />
            <div className="relative grid gap-8 md:grid-cols-[0.65fr_1.35fr] md:items-end">
              <div>
                <p className="eyebrow">01 / PHILOSOPHY</p>
                <p
                  className="mt-8 font-mono text-7xl font-black tracking-[-0.08em] text-[var(--accent-soft)] md:text-9xl"
                  aria-hidden="true"
                >
                  01
                </p>
              </div>
              <div>
                <h2 className="section-heading max-w-3xl">{tHome('aboutTitle')}</h2>
                <p className="mt-6 max-w-3xl text-base leading-8 text-[var(--muted)] md:text-lg">
                  {tHome('aboutText')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell">
        <div className="mx-auto max-w-7xl px-5 py-20 md:py-24">
          <div data-reveal>
            <p className="eyebrow">{tHome('articlesEyebrow')}</p>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="section-heading">{tHome('articlesTitle')}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  {tHome('articlesText')}
                </p>
              </div>
              <Link href={`/${locale}/artigos`} className="section-link">
                {tHome('seeAll')} <span>→</span>
              </Link>
            </div>
          </div>

          <div className="grid-auto-fit mt-10 grid gap-5">
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
                          date: formatDate(article.publishedAt, locale) ?? '',
                        })
                      : null
                  }
                  readMore={tCommon('readMore')}
                  coverMediaId={article.coverMediaId}
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
          <div data-reveal>
            <p className="eyebrow">{tHome('newsEyebrow')}</p>

            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="section-heading">{tHome('newsTitle')}</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                  {tHome('newsText')}
                </p>
              </div>
              <Link href={`/${locale}/noticias`} className="section-link">
                {tHome('seeAll')} <span>→</span>
              </Link>
            </div>
          </div>

          <div className="grid-auto-fit mt-10 grid gap-5">
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
                  coverMediaId={item.coverMediaId}
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
        <div
          className="site-panel newsletter-signal relative overflow-hidden p-8 md:p-12"
          data-reveal
          data-tilt
        >
          <div className="panel-glow" aria-hidden="true" />
          <div className="relative flex flex-col gap-7 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">SIGNAL / NO NOISE</p>
              <h2 className="section-heading mt-4">{tHome('newsletterTitle')}</h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)]">
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
