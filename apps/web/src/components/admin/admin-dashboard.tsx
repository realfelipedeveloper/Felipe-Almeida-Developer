'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/admin-api';

interface DashboardData {
  projects: number;
  articles: number;
  news: number;
  drafts: number;
  audit: Array<{
    id: string;
    action: string;
    resourceType: string;
    resourceId: string | null;
    createdAt: string;
  }>;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<DashboardData>('/api/admin/content/dashboard')
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!data) return <p className="text-slate-400">Carregando painel…</p>;

  const cards = [
    ['Projetos', data.projects, '01', 'Portfólio'],
    ['Artigos', data.articles, '02', 'Conteúdo'],
    ['Notícias', data.news, '03', 'Atualizações'],
    ['Rascunhos', data.drafts, '04', 'Em progresso'],
  ];

  return (
    <div>
      <div className="max-w-4xl">
        <p className="eyebrow">ADMIN / OVERVIEW</p>
        <h1 className="mt-5 text-5xl font-bold tracking-[-0.06em] md:text-6xl">
          Painel administrativo
        </h1>
        <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400">
          Gerencie conteúdo, acompanhe atividade e mantenha a presença digital em ordem.
        </p>
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, index, description]) => (
          <div key={label} className="site-panel group overflow-hidden p-6">
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm font-semibold text-zinc-400">{label}</p>
              <span className="font-mono text-[10px] text-zinc-600">{index}</span>
            </div>
            <p className="mt-7 text-5xl font-black tracking-[-0.06em] text-white">{value}</p>
            <p className="mt-2 text-xs text-zinc-600">{description}</p>
            <div className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-transform group-hover:scale-x-100" />
          </div>
        ))}
      </div>
      <section className="site-panel mt-10 overflow-hidden p-6 md:p-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">AUDIT LOG</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em]">Atividade recente</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] text-zinc-500">
            LIVE
          </span>
        </div>
        <div className="mt-6 divide-y divide-white/[0.07]">
          {data.audit.length ? (
            data.audit.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm"
              >
                <span className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--accent)]" />
                  {item.action} · {item.resourceType}
                </span>
                <span className="font-mono text-[11px] text-zinc-600">
                  {new Date(item.createdAt).toLocaleString('pt-BR')}
                </span>
              </div>
            ))
          ) : (
            <p className="py-3 text-sm text-slate-500">Nenhuma atividade registrada ainda.</p>
          )}
        </div>
      </section>
    </div>
  );
}
