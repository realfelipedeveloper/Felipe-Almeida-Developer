import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-4xl flex-col justify-center px-5 py-16">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">404</p>
      <h1 className="mt-4 text-5xl font-black tracking-[-0.05em] text-slate-950 dark:text-white">Conteúdo não encontrado.</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">O endereço pode ter mudado ou o conteúdo ainda não está publicado neste idioma.</p>
      <Link href="/" className="mt-7 w-fit rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white dark:bg-white dark:text-slate-950">Voltar ao início</Link>
    </main>
  );
}
