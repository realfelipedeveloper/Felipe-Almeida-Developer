import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { isLocale } from '@/i18n/config';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('newsletterTitle'), description: t('siteDescription'), path: 'newsletter' });
}

export default async function NewsletterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const t = await getTranslations({ locale, namespace: 'newsletter' });

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto max-w-3xl px-5 pb-20">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 dark:border-slate-800 dark:bg-slate-900/60">
          <form className="grid gap-5">
            <label className="text-sm font-bold">{t('name')}<input disabled className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm font-bold">{t('email')}<input type="email" disabled className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <button type="button" disabled className="rounded-xl bg-slate-400 px-5 py-3 text-sm font-bold text-white opacity-70">{t('subscribe')}</button>
          </form>
          <p className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">{t('pending')}</p>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{t('privacy')}</p>
        </div>
      </section>
    </main>
  );
}
