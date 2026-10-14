import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PrivacyVerification } from '@/components/privacy-verification';
import { isLocale } from '@/i18n/config';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: 'privacy.verify' });
  return { title: t('metadataTitle'), robots: { index: false, follow: false } };
}

export default async function PrivacyVerifyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return null;
  const t = await getTranslations({ locale, namespace: 'privacy.verify' });

  return (
    <main className="mx-auto min-h-[60vh] max-w-5xl px-5 py-20">
      <PrivacyVerification
        labels={{
          processing: t('processing'),
          exportReady: t('exportReady'),
          deletionComplete: t('deletionComplete'),
          download: t('download'),
          invalid: t('invalid'),
          confirmTitle: t('confirmTitle'),
          confirmDescription: t('confirmDescription'),
          confirmAction: t('confirmAction'),
        }}
      />
    </main>
  );
}
