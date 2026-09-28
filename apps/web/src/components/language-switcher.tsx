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
    <div className="flex items-center gap-1 rounded-full border border-slate-300 p-1 dark:border-slate-700">
      {locales.map((item) => (
        <a
          key={item}
          href={hrefFor(item)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
            item === locale
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
              : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          {labels[item]}
        </a>
      ))}
    </div>
  );
}
