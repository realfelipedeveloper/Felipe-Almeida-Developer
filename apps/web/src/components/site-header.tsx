import Link from 'next/link';
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
    menu: string;
  };
}

export function SiteHeader({ locale, labels }: SiteHeaderProps) {
  const links = [
    [labels.home, `/${locale}`],
    [labels.about, `/${locale}/sobre`],
    [labels.projects, `/${locale}/projetos`],
    [labels.articles, `/${locale}/artigos`],
    [labels.news, `/${locale}/noticias`],
    [labels.contact, `/${locale}/contato`],
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-slate-50/85 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href={`/${locale}`} className="shrink-0 text-sm font-black tracking-[-0.03em] text-slate-950 dark:text-white">
          FELIPE<span className="text-slate-400">.DEV</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm text-slate-600 dark:text-slate-300 lg:flex">
          {links.slice(1).map(([label, href]) => (
            <Link key={href} href={href} className="transition hover:text-slate-950 dark:hover:text-white">
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />
          <details className="relative lg:hidden">
            <summary className="cursor-pointer list-none rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700">
              {labels.menu}
            </summary>
            <div className="absolute right-0 mt-3 w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-950">
              {links.map(([label, href]) => (
                <Link key={href} href={href} className="block rounded-xl px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-900">
                  {label}
                </Link>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
