import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '@/components/contact-form';
import { PageHero } from '@/components/page-hero';
import { isLocale, type Locale } from '@/i18n/config';
import { getProfile } from '@/lib/api/client';
import { safeExternalUrl } from '@/lib/content';
import { pageMetadata } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return pageMetadata({
    locale,
    title: t('contactTitle'),
    description: t('siteDescription'),
    path: 'contato',
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;

  const locale: Locale = rawLocale;
  const t = await getTranslations({ locale, namespace: 'contact' });
  const profile = await getProfile(locale);
  const links = (profile?.socialLinks ?? [])
    .map((link) => ({ ...link, safeUrl: safeExternalUrl(link.url) }))
    .filter((link) => link.safeUrl);

  return (
    <main>
      <PageHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('intro')}
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-5 pb-24 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="site-panel p-6 md:p-8">
          <ContactForm
            locale={locale}
            labels={{
              name: t('name'),
              email: t('email'),
              subject: t('subject'),
              message: t('message'),
              send: t('send'),
            }}
          />
        </div>

        <aside className="site-panel relative overflow-hidden p-7 md:p-8">
          <div className="panel-glow" aria-hidden="true" />
          <p className="eyebrow">{t('channels')}</p>
          <h2 className="mt-4 text-2xl font-bold tracking-[-0.03em]">
            {locale === 'pt-BR'
              ? 'Conexões diretas, sem intermediários.'
              : locale === 'en'
                ? 'Direct connections, no middlemen.'
                : 'Conexiones directas, sin intermediarios.'}
          </h2>

          <div className="mt-7 grid gap-3">
            {profile?.publicEmail ? (
              <a href={`mailto:${profile.publicEmail}`} className="contact-channel">
                <span>E-mail</span>
                <strong>{profile.publicEmail}</strong>
                <span aria-hidden="true">↗</span>
              </a>
            ) : null}

            {links.map((link) => (
              <a
                key={link.url}
                href={link.safeUrl!}
                target="_blank"
                rel="noreferrer"
                className="contact-channel"
              >
                <span>Social</span>
                <strong>{link.label}</strong>
                <span aria-hidden="true">↗</span>
              </a>
            ))}

            {!profile?.publicEmail && !links.length ? (
              <p className="text-sm leading-6 text-zinc-400">
                {t('noChannels')}
              </p>
            ) : null}
          </div>
        </aside>
      </section>
    </main>
  );
}
