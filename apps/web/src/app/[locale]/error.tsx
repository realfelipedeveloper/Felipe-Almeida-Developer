'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-4xl flex-col justify-center px-5 py-16">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500">Erro</p>
      <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">Não foi possível carregar esta página.</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">Tente novamente. Se o problema persistir, a API pode estar temporariamente indisponível.</p>
      <button type="button" onClick={reset} className="mt-7 w-fit rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950">Tentar novamente</button>
    </main>
  );
}
