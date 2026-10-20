import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { CookiePreferencesButton } from './cookie-preferences-button';

export function SiteFooter({
  locale,
  tagline,
  rights,
  privacy,
  cookies,
  cookiePreferences,
  rss,
}: {
  locale: Locale;
  tagline: string;
  rights: string;
  privacy: string;
  cookies: string;
  cookiePreferences: string;
  rss: string;
}) {
  return (
    <footer className="section-shell mt-10 overflow-hidden">
      <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="flex items-center gap-3">
              <span className="brand-mark" aria-hidden="true">
                FA
              </span>
              <p className="eyebrow">FELIPE.DEV / SOFTWARE ENGINEERING</p>
            </div>
            <p className="mt-6 max-w-xl text-sm leading-7 text-[var(--muted)]">{tagline}</p>
          </div>

          <nav
            aria-label="Legal"
            className="flex flex-wrap gap-x-5 gap-y-3 text-xs font-semibold text-[var(--muted)]"
          >
            <Link href={`/${locale}/privacidade`} className="transition hover:text-[var(--accent)]">
              {privacy}
            </Link>
            <Link href={`/${locale}/cookies`} className="transition hover:text-[var(--accent)]">
              {cookies}
            </Link>
            <CookiePreferencesButton label={cookiePreferences} />
            <Link href={`/${locale}/rss.xml`} className="transition hover:text-[var(--accent)]">
              {rss}
            </Link>
          </nav>
        </div>

        <p
          className="mt-16 select-none text-[clamp(3.2rem,12vw,9rem)] font-black leading-none tracking-[-0.085em] text-[var(--text)] opacity-[0.045]"
          aria-hidden="true"
        >
          BUILD. EVOLVE.
        </p>

        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--border)] pt-6 text-xs text-[var(--subtle)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Felipe Almeida</p>
          <p>{rights}</p>
        </div>
      </div>
    </footer>
  );
}
