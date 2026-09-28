import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { isLocale, type Locale } from '@/i18n/config';
import { getProfile } from '@/lib/api/client';
import { cleanSeedText } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('aboutTitle'), description: t('siteDescription'), path: 'sobre' });
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale: Locale = rawLocale;
  const t = await getTranslations({ locale, namespace: 'about' });
  const hero = await getTranslations({ locale, namespace: 'hero' });
  const profile = await getProfile(locale);

  const bio = cleanSeedText(profile?.bio, t('fallbackBio'));
  const headline = cleanSeedText(profile?.headline, hero('fallbackHeadline'));

  const principles = ['architecture', 'security', 'maintenance'] as const;
  const gallery = Array.from({ length: 9 }, (_, index) => `/images/gallery/felipe-${String(index + 1).padStart(2, '0')}.jpg`);

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />

      <section className="mx-auto grid max-w-7xl gap-10 px-5 pb-20 md:grid-cols-[0.72fr_1.28fr]">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-slate-800">
          <Image src="/images/Eu.png" alt="Felipe Almeida" width={1170} height={1560} className="h-full min-h-[28rem] w-full object-cover object-top" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400">{headline}</p>
          <p className="mt-5 whitespace-pre-wrap text-lg leading-9 text-slate-600 dark:text-slate-300">{bio}</p>
          {profile?.publicLocation && !profile.publicLocation.toUpperCase().startsWith('TODO') ? (
            <p className="mt-6 text-sm font-semibold text-slate-500 dark:text-slate-400">{profile.publicLocation}</p>
          ) : null}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/45 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="mx-auto max-w-7xl px-5 py-16 md:py-20">
          <h2 className="text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">{t('principlesTitle')}</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {principles.map((key) => (
              <article key={key} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-xl font-black text-slate-950 dark:text-white">{t(`principles.${key}.title`)}</h3>
                <p className="mt-3 leading-7 text-slate-600 dark:text-slate-300">{t(`principles.${key}.text`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16 md:py-20">
        <h2 className="text-3xl font-black tracking-[-0.035em] text-slate-950 dark:text-white">{t('galleryTitle')}</h2>
        <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-300">{t('galleryText')}</p>
        <div className="mt-8 columns-2 gap-4 md:columns-3">
          {gallery.map((src, index) => (
            <div key={src} className="mb-4 break-inside-avoid overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <Image src={src} alt={`Felipe Almeida ${index + 1}`} width={900} height={1200} className="h-auto w-full object-cover" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
