import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { ProjectListItem } from '@/lib/api/types';
import { Tag } from './tag';

export function ProjectCard({
  locale,
  project,
  detailsLabel,
  lifecycleLabel,
}: {
  locale: Locale;
  project: ProjectListItem;
  detailsLabel: string;
  lifecycleLabel: string;
}) {
  return (
    <article className="site-card group flex h-full flex-col p-6 md:p-7">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">{lifecycleLabel}</span>
        {project.featured ? (
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.65)]" />
            featured
          </span>
        ) : null}
      </div>

      <h2 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-zinc-950 dark:text-zinc-100">
        {project.title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7 text-zinc-600 dark:text-zinc-400">
        {project.summary}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {project.technologies.slice(0, 5).map((technology) => (
          <Tag key={technology.slug}>{technology.name}</Tag>
        ))}
      </div>

      <Link
        href={`/${locale}/projetos/${project.slug}`}
        className="section-link mt-7"
      >
        {detailsLabel}
        <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
          →
        </span>
      </Link>
    </article>
  );
}
