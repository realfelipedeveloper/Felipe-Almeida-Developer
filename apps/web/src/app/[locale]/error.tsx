'use client';

import { useTranslations } from 'next-intl';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('common');

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-5xl flex-col justify-center px-5 py-16">
      <p className="eyebrow text-rose-400">{t('errorLabel')}</p>
      <h1 className="page-hero-title mt-7 text-[clamp(3rem,7vw,6rem)]">{t('errorTitle')}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        {t('errorDescription')}
      </p>
      <button type="button" onClick={reset} className="btn-primary mt-8 w-fit">
        {t('retry')}
      </button>
    </main>
  );
}
