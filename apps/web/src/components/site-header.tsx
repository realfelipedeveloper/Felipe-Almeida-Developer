'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { LanguageSwitcher } from './language-switcher';
import { ThemeToggle } from './theme-toggle';

interface SiteHeaderProps {
  locale: Locale;
  labels: {
    home: string;
    about: string;
    projects: string;
    articles: string;
    news: string;
    contact: string;
    newsletter: string;
    menu: string;
  };
}

export function SiteHeader({ locale, labels }: SiteHeaderProps) {
  const pathname = usePathname();
  const links = [
    [labels.home, `/${locale}`],
    [labels.about, `/${locale}/sobre`],
    [labels.projects, `/${locale}/projetos`],
    [labels.articles, `/${locale}/artigos`],
    [labels.news, `/${locale}/noticias`],
    [labels.contact, `/${locale}/contato`],
    [labels.newsletter, `/${locale}/newsletter`],
  ] as const;

  function isCurrent(href: string) {
    if (href === `/${locale}`) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="site-header">
      <div className="nav-shell">
        <Link
          href={`/${locale}`}
          className="group flex shrink-0 items-center gap-3"
          aria-label="Felipe.dev"
        >
          <span className="brand-mark" aria-hidden="true">
            FA
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-extrabold tracking-[-0.045em] text-[var(--text)]">
              FELIPE<span className="font-medium text-[var(--subtle)]">.DEV</span>
            </span>
            <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--subtle)]">
              Software engineer
            </span>
          </span>
        </Link>

        <nav aria-label={labels.menu} className="hidden items-center gap-0.5 lg:flex">
          {links.slice(1).map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="nav-link"
              aria-current={isCurrent(href) ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />

          <details className="group/menu relative lg:hidden">
            <summary className="flex h-10 list-none items-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--panel-soft)] px-3 text-xs font-bold text-[var(--text)]">
              <span className="grid gap-1" aria-hidden="true">
                <span className="h-px w-3.5 bg-current" />
                <span className="h-px w-3.5 bg-current" />
              </span>
              {labels.menu}
            </summary>
            <div
              role="menu"
              aria-label={`${labels.menu} mobile`}
              className="site-panel absolute right-0 mt-3 w-[min(19rem,calc(100vw-2rem))] p-2"
            >
              {links.map(([label, href], index) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isCurrent(href) ? 'page' : undefined}
                  className="flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--text)]"
                >
                  <span>{label}</span>
                  <span className="font-mono text-[10px] text-[var(--subtle)]" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
