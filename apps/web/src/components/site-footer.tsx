import Link from 'next/link';
import type { Locale } from '@/i18n/config';

export function SiteFooter({
  locale,
  tagline,
  rights,
  privacy,
  cookies,
  rss,
}: {
  locale: Locale;
  tagline: string;
  rights: string;
  privacy: string;
  cookies: string;
  rss: string;
}) {
  return (
    <footer className="border-t border-slate-200/70 bg-white/50 dark:border-slate-800 dark:bg-slate-950/40">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-10 text-sm text-slate-500 md:flex-row md:items-center md:justify-between dark:text-slate-400">
        <div>
          <p className="font-bold text-slate-900 dark:text-slate-100">Felipe Almeida Developer</p>
          <p className="mt-1">{tagline}</p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={`/${locale}/privacidade`} className="hover:text-slate-950 dark:hover:text-white">{privacy}</Link>
          <Link href={`/${locale}/cookies`} className="hover:text-slate-950 dark:hover:text-white">{cookies}</Link>
          <Link href={`/${locale}/rss.xml`} className="hover:text-slate-950 dark:hover:text-white">{rss}</Link>
        </div>
        <p>© {new Date().getFullYear()} {rights}</p>
      </div>
    </footer>
  );
}
