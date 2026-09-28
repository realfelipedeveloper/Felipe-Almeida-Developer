import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { Tag } from './tag';

export function ContentCard({
  locale,
  hrefBase,
  title,
  slug,
  summary,
  tags,
  meta,
  readMore,
}: {
  locale: Locale;
  hrefBase: 'artigos' | 'noticias';
  title: string;
  slug: string;
  summary: string;
  tags: Array<{ label: string; slug: string }>;
  meta?: string | null;
  readMore: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
      {meta ? <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{meta}</p> : null}
      <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{title}</h2>
      <p className="mt-3 flex-1 leading-7 text-slate-600 dark:text-slate-300">{summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">{tags.slice(0, 4).map((tag) => <Tag key={tag.slug}>{tag.label}</Tag>)}</div>
      <Link href={`/${locale}/${hrefBase}/${slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
        {readMore} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
