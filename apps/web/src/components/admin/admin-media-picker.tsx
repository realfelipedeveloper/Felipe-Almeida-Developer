'use client';

import { useEffect, useState } from 'react';
import { adminFetch } from '@/lib/admin/admin-api';

export interface AdminMediaItem {
  id: string;
  kind: 'IMAGE' | 'PDF';
  originalName: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
  url: string;
  previewUrl: string;
  translations: Array<{
    locale: 'PT_BR' | 'EN' | 'ES';
    title: string | null;
    altText: string | null;
  }>;
}

interface MediaListResponse {
  data: AdminMediaItem[];
  meta: { total: number };
}

export function AdminMediaPicker({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: 'IMAGE' | 'PDF';
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<MediaListResponse>(`/api/admin/media?kind=${kind}&limit=100`)
      .then((result) => setItems(result.data))
      .catch((cause: Error) => setError(cause.message));
  }, [kind]);

  return (
    <label className="text-sm font-semibold">
      {label}
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value || null)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
      >
        <option value="">Nenhuma mídia</option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.originalName} · {(item.byteSize / 1024).toFixed(1)} KB
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
      <span className="mt-1 block text-xs font-normal text-slate-500">
        Envie novos arquivos na seção Mídia do painel.
      </span>
    </label>
  );
}

export function AdminMediaMultiPicker({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    adminFetch<MediaListResponse>('/api/admin/media?kind=IMAGE&limit=100')
      .then((result) => setItems(result.data))
      .catch((cause: Error) => setError(cause.message));
  }, []);

  function toggle(id: string) {
    onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  }

  return (
    <fieldset className="md:col-span-2 lg:col-span-3">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-3 sm:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <label key={item.id} className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={values.includes(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span className="truncate">{item.originalName}</span>
            </label>
          ))
        ) : (
          <span className="text-xs text-slate-500">Nenhuma imagem disponível.</span>
        )}
      </div>
      {error ? <span className="mt-1 block text-xs text-red-300">{error}</span> : null}
    </fieldset>
  );
}
