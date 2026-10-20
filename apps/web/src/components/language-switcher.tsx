'use client';

import { usePathname } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';

const labels: Record<Locale, string> = {
  'pt-BR': 'PT',
  en: 'EN',
  es: 'ES',
};

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();

  function hrefFor(target: Locale) {
    const parts = pathname.split('/');
    if (parts.length > 1) parts[1] = target;
    return parts.join('/') || `/${target}`;
  }

  return (
    <div className="flex items-center gap-0.5 rounded-xl border border-[var(--border)] bg-[var(--panel-soft)] p-1">
      {locales.map((item) => (
        <a
          key={item}
          href={hrefFor(item)}
          className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold tracking-wide transition ${
            item === locale
              ? 'bg-[var(--text)] text-[var(--page)] shadow-sm'
              : 'text-[var(--subtle)] hover:bg-[var(--accent-soft)] hover:text-[var(--text)]'
          }`}
          aria-current={item === locale ? 'true' : undefined}
        >
          {labels[item]}
        </a>
      ))}
    </div>
  );
}
