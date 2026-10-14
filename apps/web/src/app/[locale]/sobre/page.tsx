import type { Metadata } from 'next';
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
  const profile = await getProfile(locale);
  if (!profile) return null;
  const bio = profile.bio.trim().toUpperCase().startsWith('TODO') ? null : profile.bio;

  return (
    <main>
      <PageHero
        eyebrow={profile.aboutEyebrow}
        title={profile.aboutTitle}
        description={profile.aboutIntro}
      />

      <section
        className={`mx-auto grid max-w-7xl gap-10 px-5 pb-20 ${
          profile.avatarMediaId ? 'md:grid-cols-[0.72fr_1.28fr]' : ''
        }`}
      >
        {profile.avatarMediaId ? (
          <div className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(profile.avatarMediaId) ?? undefined}
              alt={profile.fullName}
              className="h-full min-h-[28rem] w-full object-cover object-top"
            />
          </div>
        ) : null}
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
            {profile.headline}
          </p>
          {bio ? (
            <p className="mt-5 whitespace-pre-wrap text-lg leading-9 text-slate-600 dark:text-slate-300">
              {bio}
            </p>
          ) : null}
          {profile?.publicLocation && !profile.publicLocation.toUpperCase().startsWith('TODO') ? (
            <p className="mt-6 text-sm font-semibold text-slate-500 dark:text-slate-400">
              {profile.publicLocation}
            </p>
          ) : null}
          {profile.resumeMediaId ? (
            <a
              href={mediaUrl(profile.resumeMediaId) ?? undefined}
              className="mt-6 inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold dark:border-slate-700"
            >
              {profile.aboutResumeLabel} ↓
            </a>
          ) : null}
        </div>
      </section>

      {profile.principles.length ? (
        <section className="border-y border-slate-200/70 bg-white/45 dark:border-slate-800 dark:bg-slate-950/30">
          <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
            <h2 className="text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">
              {profile.aboutPrinciplesTitle}
            </h2>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              {profile.principles.map((principle) => (
                <article
                  key={principle.id}
                  className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60"
                >
                  <h3 className="text-xl font-black text-slate-950 dark:text-white">
                    {principle.title}
                  </h3>
                  <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">
                    {principle.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {profile.gallery.length ? (
        <section className="mx-auto max-w-7xl px-5 py-16 md:py-20">
          <h2 className="text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">
            {profile.aboutGalleryTitle}
          </h2>
          <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">
            {profile.aboutGalleryText}
          </p>
          <div className="mt-8 columns-2 gap-4 md:columns-3">
            {profile.gallery.map((item) => (
              <div
                key={item.mediaId}
                className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(item.mediaId) ?? undefined}
                  alt={item.altText || profile.fullName}
                  className="h-auto w-full object-cover"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
