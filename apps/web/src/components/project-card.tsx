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
    <article className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{lifecycleLabel}</span>
        {project.featured ? <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" title="Destaque" /> : null}
      </div>
      <h2 className="mt-5 text-2xl font-black tracking-[-0.03em] text-slate-950 dark:text-white">{project.title}</h2>
      <p className="mt-3 flex-1 leading-7 text-slate-600 dark:text-slate-300">{project.summary}</p>
      <div className="mt-5 flex flex-wrap gap-2">
        {project.technologies.slice(0, 5).map((technology) => <Tag key={technology.slug}>{technology.name}</Tag>)}
      </div>
      <Link href={`/${locale}/projetos/${project.slug}`} className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
        {detailsLabel} <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
