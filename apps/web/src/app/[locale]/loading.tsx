export default function Loading() {
  return (
    <main className="mx-auto min-h-[60vh] max-w-7xl px-5 py-20">
      <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-6 h-16 max-w-3xl animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      <div className="mt-6 h-28 max-w-2xl animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
    </main>
  );
}
