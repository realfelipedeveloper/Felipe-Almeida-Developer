export default function Loading() {
  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-24">
      <div className="h-3 w-40 animate-pulse rounded-full bg-[var(--accent-soft)]" />
      <div className="mt-8 h-20 max-w-4xl animate-pulse rounded-3xl bg-[var(--panel)]" />
      <div className="mt-5 h-20 max-w-2xl animate-pulse rounded-3xl bg-[var(--panel)]" />
      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-72 animate-pulse rounded-[1.5rem] border border-[var(--border)] bg-[var(--panel)]"
          />
        ))}
      </div>
    </main>
  );
}
