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
    <nav
      className="mt-12 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-7"
      aria-label="Paginação"
    >
      <div>
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary min-h-0 px-4 py-2">
            ← {previousLabel}
          </Link>
        ) : null}
      </div>
      <span className="font-mono text-xs text-[var(--subtle)]">{pageLabel}</span>
      <div>
        {page < totalPages ? (
          <Link href={href(page + 1)} className="btn-secondary min-h-0 px-4 py-2">
            {nextLabel} →
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
