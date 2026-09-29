'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin/admin-api';

const links = [
  ['Painel', '/admin'],
  ['Perfil', '/admin/perfil'],
  ['Projetos', '/admin/projetos'],
  ['Artigos', '/admin/artigos'],
  ['Notícias', '/admin/noticias'],
  ['Contatos', '/admin/contatos'],
  ['Newsletter', '/admin/newsletter'],
  ['Segurança', '/admin/seguranca'],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  async function logout() {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[#09090a] text-zinc-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.07] bg-[#09090a]/88 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-3.5">
          <Link href="/admin" className="flex items-center gap-2 text-sm font-extrabold tracking-[-0.035em]">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 font-mono text-[10px] text-zinc-300">
              &lt;/&gt;
            </span>
            FELIPE.DEV <span className="font-medium text-zinc-600">ADMIN</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-xs font-semibold text-zinc-400">
            {links.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="rounded-full px-3 py-2 transition hover:bg-white/[0.055] hover:text-white"
              >
                {label}
              </Link>
            ))}
            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-full border border-zinc-800 px-3 py-2 transition hover:border-zinc-600 hover:text-white"
            >
              Sair
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-10">{children}</main>
    </div>
  );
}
