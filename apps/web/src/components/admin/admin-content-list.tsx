'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';

interface TranslationRow { locale: string; title: string; slug: string }
interface ContentRow {
  id: string;
  publicationStatus: string;
  translations: TranslationRow[];
  createdAt: string;
}

export function AdminContentList({
  kind,
  title,
  singular,
}: {
  kind: 'projects' | 'articles' | 'news';
  title: string;
  singular: string;
}) {
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setItems(await adminFetch<ContentRow[]>(`/api/admin/content/${kind}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar conteúdo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [kind]);

  async function remove(id: string, name: string) {
    if (!window.confirm(`Excluir definitivamente ${singular.toLowerCase()} “${name}”?`)) return;
    try {
      await adminFetch(`/api/admin/content/${kind}/${id}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Falha ao excluir conteúdo.');
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-4xl font-black tracking-tight">{title}</h1><p className="mt-2 text-slate-400">Crie, edite, publique e remova conteúdo.</p></div>
        <Link href={`/admin/${kind === 'projects' ? 'projetos' : kind === 'articles' ? 'artigos' : 'noticias'}/novo`} className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950">Novo {singular.toLowerCase()}</Link>
      </div>
      {error ? <p className="mt-6 text-red-300">{error}</p> : null}
      {loading ? <p className="mt-8 text-slate-400">Carregando…</p> : (
        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800">
          <div className="divide-y divide-slate-800">
            {items.length ? items.map((item) => {
              const pt = item.translations.find((translation) => translation.locale === 'PT_BR') ?? item.translations[0];
              const hrefBase = kind === 'projects' ? 'projetos' : kind === 'articles' ? 'artigos' : 'noticias';
              return (
                <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-5 py-4">
                  <div><p className="font-bold">{pt?.title ?? 'Sem título'}</p><p className="mt-1 text-xs text-slate-500">{item.publicationStatus} · {pt?.slug ?? '-'}</p></div>
                  <div className="flex gap-3 text-sm"><Link href={`/admin/${hrefBase}/${item.id}`} className="text-slate-200 hover:text-white">Editar</Link><button type="button" onClick={() => remove(item.id, pt?.title ?? singular)} className="text-red-300">Excluir</button></div>
                </div>
              );
            }) : <p className="bg-slate-900 px-5 py-8 text-sm text-slate-500">Nenhum conteúdo cadastrado.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
