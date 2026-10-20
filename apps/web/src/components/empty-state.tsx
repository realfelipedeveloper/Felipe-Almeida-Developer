export function EmptyState({ text }: { text: string }) {
  return (
    <div className="site-panel grid min-h-52 place-items-center border-dashed p-10 text-center">
      <div>
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] font-mono text-[var(--accent)]"
          aria-hidden="true"
        >
          ∅
        </span>
        <p className="mt-4 text-sm text-[var(--muted)]">{text}</p>
      </div>
    </div>
  );
}
