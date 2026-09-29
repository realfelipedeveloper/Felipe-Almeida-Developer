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
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-2xl dark:border-white/[0.07] dark:bg-[#09090a]/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3.5">
        <Link href={`/${locale}`} className="group flex shrink-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-300 bg-zinc-100 font-mono text-[10px] font-black text-zinc-700 transition group-hover:-rotate-3 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            &lt;/&gt;
          </span>
          <span className="text-sm font-extrabold tracking-[-0.035em] text-zinc-950 dark:text-zinc-100">
            FELIPE<span className="font-medium text-zinc-500">.DEV</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-zinc-200/80 bg-zinc-100/60 p-1 text-xs font-semibold text-zinc-600 lg:flex dark:border-white/[0.07] dark:bg-white/[0.025] dark:text-zinc-400">
          {links.slice(1).map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-full px-3.5 py-2 transition hover:bg-white hover:text-zinc-950 dark:hover:bg-white/[0.07] dark:hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher locale={locale} />
          <ThemeToggle />

          <details className="relative lg:hidden">
            <summary className="grid h-9 cursor-pointer list-none place-items-center rounded-full border border-zinc-300 px-3 text-xs font-bold dark:border-zinc-800">
              {labels.menu}
            </summary>
            <div className="site-panel absolute right-0 mt-3 w-56 p-2">
              {links.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-xl px-3 py-2.5 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/[0.06]"
                >
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
