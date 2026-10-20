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
      className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] text-[var(--muted)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
      aria-label={label}
      title={label}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        {dark ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v2m0 14v2M3 12h2m14 0h2M5.64 5.64l1.42 1.42m9.88 9.88 1.42 1.42m0-12.72-1.42 1.42M7.06 16.94l-1.42 1.42M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
          />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8 8.5 8.5 0 1 0 20.2 15.2Z"
          />
        )}
      </svg>
    </button>
  );
}
