'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function ThemeToggle() {
  const t = useTranslations('theme');
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem('fad-theme');
    const nextDark = stored !== 'light';
    document.documentElement.classList.toggle('dark', nextDark);
    setDark(nextDark);
  }, []);

  function toggleTheme() {
    const nextDark = !dark;
    document.documentElement.classList.toggle('dark', nextDark);
    window.localStorage.setItem('fad-theme', nextDark ? 'dark' : 'light');
    setDark(nextDark);
  }

  const label = dark ? t('light') : t('dark');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid h-9 w-9 place-items-center rounded-full border border-zinc-300 bg-zinc-100/60 text-xs text-zinc-600 transition hover:-translate-y-0.5 dark:border-zinc-800 dark:bg-white/[0.025] dark:text-zinc-400"
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">{dark ? '◐' : '◑'}</span>
    </button>
  );
}
