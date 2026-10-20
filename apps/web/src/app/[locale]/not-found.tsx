import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const locale = await getLocale();
  const t = await getTranslations('common');

  return (
    <main className="mx-auto flex min-h-[75vh] max-w-5xl flex-col justify-center px-5 py-16">
      <p className="font-mono text-[clamp(5rem,18vw,12rem)] font-black leading-none tracking-[-0.09em] text-[var(--accent-soft)]">
        404
      </p>
      <h1 className="page-hero-title -mt-6 text-[clamp(3rem,7vw,6rem)]">{t('notFound')}</h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        {t('notFoundDescription')}
      </p>
      <Link href={`/${locale}`} className="btn-primary mt-8 w-fit">
        {t('backHome')}
      </Link>
    </main>
  );
}
