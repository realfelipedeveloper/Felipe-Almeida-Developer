import Link from 'next/link';

export function Pagination({
  path,
  page,
  totalPages,
  params,
  previousLabel,
  nextLabel,
  pageLabel,
}: {
  path: string;
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
  previousLabel: string;
  nextLabel: string;
  pageLabel: string;
}) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    search.set('page', String(target));
    return `${path}?${search.toString()}`;
  };

  return (
    <nav className="mt-10 flex items-center justify-between gap-4 border-t border-slate-200 pt-6 dark:border-slate-800" aria-label="Paginação">
      <div>
        {page > 1 ? (
          <Link href={href(page - 1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
            ← {previousLabel}
          </Link>
        ) : null}
      </div>
      <span className="text-sm text-slate-500 dark:text-slate-400">{pageLabel}</span>
      <div>
        {page < totalPages ? (
          <Link href={href(page + 1)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">
            {nextLabel} →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
