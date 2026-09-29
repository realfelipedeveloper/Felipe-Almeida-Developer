'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/admin-api';

interface DashboardData {
  projects: number;
  articles: number;
  news: number;
  drafts: number;
  audit: Array<{ id: string; action: string; resourceType: string; resourceId: string | null; createdAt: string }>;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<DashboardData>('/api/admin/content/dashboard').then(setData).catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) return <p className="text-red-300">{error}</p>;
  if (!data) return <p className="text-slate-400">Carregando painel…</p>;

  const cards = [
    ['Projetos', data.projects],
    ['Artigos', data.articles],
    ['Notícias', data.news],
    ['Rascunhos', data.drafts],
  ];

  return (
    <div>
      <h1 className="text-4xl font-black tracking-tight">Painel administrativo</h1>
      <p className="mt-2 text-slate-400">Gerencie o conteúdo do portfólio com autenticação, sessões revogáveis, CSRF e auditoria.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </div>
        ))}
      </div>
      <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h2 className="text-xl font-bold">Atividade recente</h2>
        <div className="mt-4 divide-y divide-slate-800">
          {data.audit.length ? data.audit.map((item) => (
            <div key={item.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
              <span>{item.action} · {item.resourceType}</span>
              <span className="text-slate-500">{new Date(item.createdAt).toLocaleString('pt-BR')}</span>
            </div>
          )) : <p className="py-3 text-sm text-slate-500">Nenhuma atividade registrada ainda.</p>}
        </div>
      </section>
    </div>
  );
}
