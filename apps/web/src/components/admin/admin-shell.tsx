'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin/admin-api';

const links = [
  ['Painel', '/admin'],
  ['Perfil', '/admin/perfil'],
  ['Projetos', '/admin/projetos'],
  ['Artigos', '/admin/artigos'],
  ['Notícias', '/admin/noticias'],
  ['Mídia', '/admin/midia'],
  ['Contatos', '/admin/contatos'],
  ['Newsletter', '/admin/newsletter'],
  ['Segurança', '/admin/seguranca'],
] as const;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  async function logout() {
    try {
      await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/admin/login');
      router.refresh();
    }
  }

  function isCurrent(href: string) {
    if (href === '/admin') return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="admin-workspace lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="admin-sidebar z-50 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-4 py-4 lg:px-5 lg:py-6">
          <Link href="/admin" className="group flex items-center gap-3">
            <span className="brand-mark" aria-hidden="true">
              FA
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-[-0.04em] text-white">
                FELIPE.DEV
              </span>
              <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                Content studio
              </span>
            </span>
          </Link>
          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest text-emerald-300">
            online
          </span>
        </div>

        <nav
          aria-label="Navegação administrativa"
          className="flex gap-1 overflow-x-auto px-3 py-3 lg:flex-1 lg:flex-col lg:overflow-visible lg:px-4 lg:py-6"
        >
          <p className="mb-2 hidden px-3 font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-600 lg:block">
            Workspace
          </p>
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="admin-nav-link shrink-0"
              aria-current={isCurrent(href) ? 'page' : undefined}
            >
              <span className="admin-nav-dot" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden border-t border-white/[0.07] p-4 lg:block">
          <Link href="/pt-BR" target="_blank" className="admin-nav-link">
            <span className="admin-nav-dot" aria-hidden="true" />
            Visualizar site{' '}
            <span className="ml-auto" aria-hidden="true">
              ↗
            </span>
          </Link>
          <button type="button" onClick={logout} className="admin-nav-link mt-1 w-full">
            <span className="admin-nav-dot" aria-hidden="true" />
            Encerrar sessão
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 hidden border-b border-white/[0.07] bg-[#070a11]/75 px-6 py-4 backdrop-blur-xl lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-zinc-600">
              Felipe.dev / Administração
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              Conteúdo, operações e segurança em um só lugar.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.6)]" />
            Serviços conectados
          </div>
        </header>

        <main className="mx-auto max-w-[92rem] px-5 py-8 md:px-8 md:py-10 lg:px-10 lg:py-12">
          {children}
        </main>

        <div className="fixed inset-x-4 bottom-4 z-50 flex gap-2 rounded-2xl border border-white/10 bg-[#0b101b]/90 p-2 shadow-2xl backdrop-blur-2xl lg:hidden">
          <Link href="/pt-BR" target="_blank" className="admin-nav-link flex-1 justify-center">
            Ver site ↗
          </Link>
          <button type="button" onClick={logout} className="admin-nav-link flex-1 justify-center">
            Sair
          </button>
        </div>
      </div>
    </div>
  );
}
