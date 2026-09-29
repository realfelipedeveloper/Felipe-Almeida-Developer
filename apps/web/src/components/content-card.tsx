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
    <article className="site-card group flex h-full flex-col p-6 md:p-7">
      {meta ? <p className="eyebrow">{meta}</p> : null}

      <h2 className="mt-4 text-2xl font-bold tracking-[-0.035em] text-zinc-950 dark:text-zinc-100">
        {title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.slice(0, 4).map((tag) => (
          <Tag key={tag.slug}>{tag.label}</Tag>
        ))}
      </div>

      <Link
        href={`/${locale}/${hrefBase}/${slug}`}
        className="section-link mt-7"
      >
        {readMore}
        <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
          →
        </span>
      </Link>
    </article>
  );
}
