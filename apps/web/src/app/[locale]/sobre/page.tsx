import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { isLocale, type Locale } from '@/i18n/config';
import { getProfile } from '@/lib/api/client';
import { mediaUrl } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const profile = await getProfile(locale);
  if (!profile) return {};
  return pageMetadata({
    locale,
    title: profile.seoTitle || profile.aboutTitle,
    description: profile.seoDescription || profile.aboutIntro,
    path: 'sobre',
  });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale: Locale = rawLocale;
  const t = await getTranslations({ locale, namespace: 'aboutUi' });
  const profile = await getProfile(locale);
  if (!profile) {
    return (
      <main data-ui="about-story" className="min-h-[60vh] overflow-hidden">
        <PageHero
          eyebrow={t('unavailableEyebrow')}
          title={t('unavailableTitle')}
          description={t('unavailableDescription')}
        />
      </main>
    );
  }
  const bio = profile.bio.trim().toUpperCase().startsWith('TODO') ? null : profile.bio;
  const hasLocation =
    profile.publicLocation && !profile.publicLocation.toUpperCase().startsWith('TODO');

  return (
    <main className="overflow-hidden">
      <PageHero
        eyebrow={profile.aboutEyebrow}
        title={profile.aboutTitle}
        description={profile.aboutIntro}
      />

      <section
        data-ui="about-story"
        className="mx-auto grid max-w-7xl gap-6 px-5 pb-24 lg:grid-cols-[0.78fr_1.22fr]"
      >
        {profile.avatarMediaId ? (
          <div
            className="site-panel relative min-h-[32rem] overflow-hidden lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)] lg:max-h-[46rem]"
            data-reveal
            data-tilt
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(profile.avatarMediaId) ?? undefined}
              alt={profile.fullName}
              className="h-full min-h-[32rem] w-full object-cover object-top"
            />
            <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-7 pt-28 text-white">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                {t('profileKicker')} / 01
              </p>
              <p className="mt-2 text-xl font-bold tracking-[-0.035em]">{profile.fullName}</p>
            </div>
          </div>
        ) : null}

        <div className="grid content-start gap-6">
          <article className="site-panel overflow-hidden p-7 md:p-10 lg:p-12" data-reveal>
            <div className="panel-glow" aria-hidden="true" />
            <div className="relative">
              <p className="eyebrow">{profile.headline}</p>
              {bio ? <p className="editorial-prose mt-8 whitespace-pre-wrap">{bio}</p> : null}

              <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-6">
                {hasLocation ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-xs font-semibold text-[var(--muted)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    {profile.publicLocation}
                  </span>
                ) : null}
                {profile.resumeMediaId ? (
                  <a href={mediaUrl(profile.resumeMediaId) ?? undefined} className="btn-primary">
                    {profile.aboutResumeLabel}
                    <span aria-hidden="true">↓</span>
                  </a>
                ) : null}
              </div>
            </div>
          </article>

          {profile.principles.length ? (
            <div className="site-panel p-7 md:p-10" data-reveal>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow">{t('principlesKicker')}</p>
                  <h2 className="section-heading mt-5 text-[clamp(2rem,4vw,3.5rem)]">
                    {profile.aboutPrinciplesTitle}
                  </h2>
                </div>
                <span className="font-mono text-xs text-[var(--subtle)]">
                  01—{String(profile.principles.length).padStart(2, '0')}
                </span>
              </div>

              <div className="mt-8 divide-y divide-[var(--border)]">
                {profile.principles.map((principle, index) => (
                  <article
                    key={principle.id}
                    className="grid gap-4 py-7 sm:grid-cols-[3.5rem_0.8fr_1.2fr] sm:gap-6"
                  >
                    <span className="font-mono text-xs text-[var(--accent)]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-xl font-bold tracking-[-0.035em] text-[var(--text)]">
                      {principle.title}
                    </h3>
                    <p className="leading-7 text-[var(--muted)]">{principle.text}</p>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {profile.gallery.length ? (
        <section className="section-shell">
          <div className="mx-auto max-w-7xl px-5 py-20 md:py-28">
            <div className="grid gap-6 md:grid-cols-[0.8fr_1.2fr] md:items-end" data-reveal>
              <div>
                <p className="eyebrow">{t('galleryKicker')}</p>
                <h2 className="section-heading mt-5">{profile.aboutGalleryTitle}</h2>
              </div>
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)] md:justify-self-end">
                {profile.aboutGalleryText}
              </p>
            </div>

            <div className="mt-12 grid auto-rows-[13rem] grid-cols-2 gap-4 md:auto-rows-[18rem] md:grid-cols-4">
              {profile.gallery.map((item, index) => (
                <figure
                  key={item.mediaId}
                  data-reveal
                  data-tilt
                  className={`gallery-tile ${
                    index % 7 === 0 ? 'col-span-2 row-span-2' : index % 5 === 0 ? 'row-span-2' : ''
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mediaUrl(item.mediaId) ?? undefined}
                    alt={item.altText || profile.fullName}
                    className="h-full w-full object-cover"
                  />
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
