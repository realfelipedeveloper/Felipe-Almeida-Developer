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
    <footer className="border-t border-zinc-200/80 dark:border-white/[0.07]">
      <div className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <p className="eyebrow">FELIPE.DEV / SOFTWARE ENGINEERING</p>
            <p className="mt-4 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              {tagline}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-zinc-500">
            <Link href={`/${locale}/privacidade`} className="hover:text-zinc-950 dark:hover:text-white">
              {privacy}
            </Link>
            <Link href={`/${locale}/cookies`} className="hover:text-zinc-950 dark:hover:text-white">
              {cookies}
            </Link>
            <Link href={`/${locale}/rss.xml`} className="hover:text-zinc-950 dark:hover:text-white">
              {rss}
            </Link>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-zinc-200/70 pt-6 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between dark:border-white/[0.06]">
          <p>© {new Date().getFullYear()} Felipe Almeida</p>
          <p>{rights}</p>
        </div>
      </div>
    </footer>
  );
}
