import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { isLocale, type Locale } from '@/i18n/config';
import { getProfile } from '@/lib/api/client';
import { safeExternalUrl } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({ locale, title: t('contactTitle'), description: t('siteDescription'), path: 'contato' });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;
  const locale: Locale = rawLocale;
  const t = await getTranslations({ locale, namespace: 'contact' });
  const profile = await getProfile(locale);
  const links = (profile?.socialLinks ?? []).map((link) => ({ ...link, safeUrl: safeExternalUrl(link.url) })).filter((link) => link.safeUrl);

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto grid max-w-7xl gap-8 px-5 pb-20 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 dark:border-slate-800 dark:bg-slate-900/60">
          <form className="grid gap-5" aria-describedby="contact-pending">
            <label className="text-sm font-bold">{t('name')}<input disabled className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm font-bold">{t('email')}<input type="email" disabled className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm font-bold">{t('subject')}<input disabled className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <label className="text-sm font-bold">{t('message')}<textarea disabled rows={6} className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 opacity-70 dark:border-slate-700 dark:bg-slate-950" /></label>
            <button type="button" disabled className="rounded-xl bg-slate-400 px-5 py-3 text-sm font-bold text-white opacity-70">{t('send')}</button>
          </form>
          <p id="contact-pending" className="mt-5 rounded-2xl bg-amber-500/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">{t('pending')}</p>
        </div>

        <aside className="rounded-3xl bg-slate-950 p-7 text-white">
          <h2 className="text-2xl font-black">{t('channels')}</h2>
          <div className="mt-6 grid gap-3">
            {profile?.publicEmail ? <a href={`mailto:${profile.publicEmail}`} className="rounded-2xl border border-white/15 p-4 font-semibold hover:bg-white/5">{profile.publicEmail}</a> : null}
            {links.map((link) => <a key={link.url} href={link.safeUrl!} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/15 p-4 font-semibold hover:bg-white/5">{link.label} ↗</a>)}
            {!profile?.publicEmail && !links.length ? <p className="text-sm leading-6 text-slate-300">{t('noChannels')}</p> : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
