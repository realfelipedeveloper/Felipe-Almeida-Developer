import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHero } from '@/components/page-hero';
import { PrivacyRequestForm } from '@/components/privacy-request-form';
import { isLocale } from '@/i18n/config';
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
    title: t('privacyTitle'),
    description: t('siteDescription'),
    path: 'privacidade',
  });
}

export default async function PolicyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const t = await getTranslations({ locale, namespace: 'privacy' });
  const sections = t.raw('sections') as Array<{ title: string; text: string }>;

  return (
    <main>
      <PageHero eyebrow={t('eyebrow')} title={t('title')} description={t('intro')} />
      <section className="mx-auto grid max-w-5xl gap-5 px-5 pb-24 md:grid-cols-2">
        {sections.map((section, index) => (
          <article key={section.title} className="legal-card">
            <span className="font-mono text-xs text-[var(--accent)]">
              {String(index + 1).padStart(2, '0')}
            </span>
            <h2 className="mt-5 text-2xl font-bold tracking-[-0.04em] text-[var(--text)]">
              {section.title}
            </h2>
            <p className="mt-4 leading-8 text-[var(--muted)]">{section.text}</p>
          </article>
        ))}
        <div className="md:col-span-2">
          <PrivacyRequestForm
            locale={locale}
            labels={{
              title: t('request.title'),
              description: t('request.description'),
              email: t('request.email'),
              type: t('request.type'),
              exportOption: t('request.exportOption'),
              deleteOption: t('request.deleteOption'),
              deleteWarning: t('request.deleteWarning'),
              submit: t('request.submit'),
              sending: t('request.sending'),
              successEyebrow: t('request.successEyebrow'),
              successTitle: t('request.successTitle'),
              successFallback: t('request.successFallback'),
              errorFallback: t('request.errorFallback'),
            }}
          />
        </div>
      </section>
    </main>
  );
}
