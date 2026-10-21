import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { ProjectListItem } from '@/lib/api/types';
import { mediaUrl } from '@/lib/content';
import { Tag } from './tag';

export function ProjectCard({
  locale,
  project,
  detailsLabel,
  lifecycleLabel,
  featuredLabel,
}: {
  locale: Locale;
  project: ProjectListItem;
  detailsLabel: string;
  lifecycleLabel: string;
  featuredLabel: string;
}) {
  return (
    <article className="site-card group flex h-full flex-col p-5 md:p-6" data-reveal data-tilt>
      {project.coverMediaId ? (
        <div className="card-media -mx-5 -mt-5 mb-6 h-52 md:-mx-6 md:-mt-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl(project.coverMediaId) ?? undefined}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      ) : (
        <div className="card-media -mx-5 -mt-5 mb-6 grid h-36 place-items-center bg-gradient-to-br from-[var(--accent-soft)] to-transparent md:-mx-6 md:-mt-6">
          <span
            className="font-mono text-4xl font-black tracking-[-0.08em] text-[var(--accent)]/50"
            aria-hidden="true"
          >
            {project.title.slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{lifecycleLabel}</span>
        {project.featured ? (
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.65)]" />
            {featuredLabel}
          </span>
        ) : null}
      </div>

      <h2 className="mt-5 text-2xl font-bold tracking-[-0.045em] text-[var(--text)] md:text-[1.7rem]">
        {project.title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7 text-[var(--muted)]">{project.summary}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {project.technologies.slice(0, 5).map((technology) => (
          <Tag key={technology.slug}>{technology.name}</Tag>
        ))}
      </div>

      <Link
        href={`/${locale}/projetos/${project.slug}`}
        className="mt-7 flex items-center justify-between border-t border-[var(--border)] pt-5 text-sm font-bold text-[var(--text)]"
      >
        {detailsLabel}
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
