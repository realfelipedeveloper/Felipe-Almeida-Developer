import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NewsletterForm } from '@/components/newsletter-form';
import { PageHero } from '@/components/page-hero';
import { isLocale, type Locale } from '@/i18n/config';
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
    title: t('newsletterTitle'),
    description: t('siteDescription'),
    path: 'newsletter',
  });
}

export default async function NewsletterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) return null;

  const locale: Locale = rawLocale;
  const t = await getTranslations({ locale, namespace: 'newsletter' });

  return (
    <main>
      <PageHero
        eyebrow={t('eyebrow')}
        title={t('title')}
        description={t('intro')}
      />

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="site-panel relative overflow-hidden p-7 md:p-10">
          <div className="panel-glow" aria-hidden="true" />

          <div className="relative">
            <div className="mb-8 grid gap-4 sm:grid-cols-3">
              {[
                ['01', 'Software'],
                ['02', 'Arquitetura'],
                ['03', 'Carreira'],
              ].map(([number, label]) => (
                <div key={number} className="newsletter-pillar">
                  <span>{number}</span>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>

            <NewsletterForm
              locale={locale}
              emailLabel={t('email')}
              submitLabel={t('subscribe')}
            />

            <p className="mt-5 text-xs leading-5 text-zinc-500">
              {t('privacy')}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
