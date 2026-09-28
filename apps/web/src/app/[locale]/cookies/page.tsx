import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { isLocale } from '@/i18n/config';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('cookiesTitle'), description: t('siteDescription'), path: 'cookies' });
}

export default async function PolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const t = await getTranslations({ locale, namespace: 'cookies' });
  const sections = t.raw('sections') as Array<{ title: string; text: string }>;

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto grid max-w-5xl gap-5 px-5 pb-20">
        {sections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="text-2xl font-black text-slate-950 dark:text-white">{section.title}</h2>
            <p className="mt-3 leading-8 text-slate-600 dark:text-slate-300">{section.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
