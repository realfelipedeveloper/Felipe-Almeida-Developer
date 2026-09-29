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
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <Link href="/admin" className="font-black tracking-tight">FELIPE.DEV <span className="text-slate-500">ADMIN</span></Link>
          <nav className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
            {links.map(([label, href]) => <Link key={href} href={href} className="hover:text-white">{label}</Link>)}
            <button type="button" onClick={logout} className="rounded-lg border border-slate-700 px-3 py-1.5 hover:border-slate-500">Sair</button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 py-10">{children}</main>
    </div>
  );
}
