export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--muted)]">
      {children}
    </span>
  );
}
