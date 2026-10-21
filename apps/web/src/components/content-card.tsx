import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import { mediaUrl } from '@/lib/content';
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
  coverMediaId,
}: {
  locale: Locale;
  hrefBase: 'artigos' | 'noticias';
  title: string;
  slug: string;
  summary: string;
  tags: Array<{ label: string; slug: string }>;
  meta?: string | null;
  readMore: string;
  coverMediaId?: string | null;
}) {
  return (
    <article className="site-card group flex h-full flex-col p-5 md:p-6" data-reveal data-tilt>
      {coverMediaId ? (
        <div className="card-media -mx-5 -mt-5 mb-6 h-48 md:-mx-6 md:-mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(coverMediaId) ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div className="card-media -mx-5 -mt-5 mb-6 grid h-32 place-items-center bg-gradient-to-br from-[var(--accent-soft)] to-transparent md:-mx-6 md:-mt-6">
          <span
            className="font-mono text-3xl font-black text-[var(--accent)]/45"
            aria-hidden="true"
          >
            //
          </span>
        </div>
      )}
      {meta ? <p className="eyebrow">{meta}</p> : null}

      <h2 className="mt-4 text-2xl font-bold tracking-[-0.045em] text-[var(--text)] md:text-[1.65rem]">
        {title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7 text-[var(--muted)]">{summary}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {tags.slice(0, 4).map((tag) => (
          <Tag key={tag.slug}>{tag.label}</Tag>
        ))}
      </div>

      <Link
        href={`/${locale}/${hrefBase}/${slug}`}
        className="mt-7 flex items-center justify-between border-t border-[var(--border)] pt-5 text-sm font-bold text-[var(--text)]"
      >
        {readMore}
        <span
          className="grid h-9 w-9 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        >
          ↗
        </span>
      </Link>
    </article>
  );
}
