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
    <div className="flex items-center gap-0.5 rounded-full border border-zinc-300 bg-zinc-100/60 p-1 dark:border-zinc-800 dark:bg-white/[0.025]">
      {locales.map((item) => (
        <a
          key={item}
          href={hrefFor(item)}
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide transition ${
            item === locale
              ? 'bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-950'
              : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-500 dark:hover:text-white'
          }`}
        >
          {labels[item]}
        </a>
      ))}
    </div>
  );
}
