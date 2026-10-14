'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminApiError, adminFetch } from '@/lib/admin/admin-api';
import { AdminFeedbackModal } from './admin-modal';
import type { AdminMediaItem } from './admin-media-picker';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface MediaListResponse {
  data: AdminMediaItem[];
  meta: { total: number };
}

export function AdminMediaLibrary() {
  const [items, setItems] = useState<AdminMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminFetch<MediaListResponse>('/api/admin/media?limit=100');
      setItems(response.data);
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível carregar a biblioteca.',
        message: cause instanceof Error ? cause.message : 'Falha inesperada.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem('file') as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      await adminFetch('/api/admin/media', { method: 'POST', body });
      form.reset();
      await load();
      setFeedback({
        variant: 'success',
        title: 'Upload concluído.',
        message: 'A mídia já está disponível para uso no conteúdo.',
      });
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Upload rejeitado.',
        message:
          cause instanceof AdminApiError ? cause.message : 'Não foi possível enviar o arquivo.',
      });
    } finally {
      setUploading(false);
    }
  }

  async function remove(item: AdminMediaItem) {
    if (!window.confirm(`Remover ${item.originalName}?`)) return;
    try {
      await adminFetch(`/api/admin/media/${item.id}`, { method: 'DELETE' });
      await load();
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível remover a mídia.',
        message: cause instanceof Error ? cause.message : 'Falha inesperada.',
      });
    }
  }

  return (
    <>
      <div>
        <p className="eyebrow">ADMIN / MÍDIA</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Biblioteca de mídia</h1>
        <p className="mt-2 text-slate-400">
          Imagens até 10 MB e currículo PDF até 20 MB. SVG e arquivos sem assinatura válida são
          rejeitados.
        </p>

        <form
          onSubmit={upload}
          className="mt-8 flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:flex-row sm:items-end"
        >
          <label className="flex-1 text-sm font-semibold">
            Arquivo
            <input
              name="file"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>
          <button
            disabled={uploading}
            className="rounded-xl bg-white px-6 py-3 font-bold text-slate-950 disabled:opacity-50"
          >
            {uploading ? 'Enviando…' : 'Enviar arquivo'}
          </button>
        </form>

        {loading ? <p className="mt-8 text-slate-400">Carregando mídias…</p> : null}
        {!loading && items.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-slate-800 p-6 text-slate-400">
            Nenhuma mídia enviada.
          </p>
        ) : null}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
            >
              {item.kind === 'IMAGE' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_BASE_URL}${item.previewUrl}`}
                  crossOrigin="use-credentials"
                  alt={item.translations.find((entry) => entry.locale === 'PT_BR')?.altText ?? ''}
                  className="h-44 w-full bg-slate-950 object-cover"
                />
              ) : (
                <div
                  className="grid h-44 place-items-center bg-slate-950 text-4xl"
                  aria-label="Documento PDF"
                >
                  PDF
                </div>
              )}
              <div className="p-5">
                <h2 className="truncate font-bold" title={item.originalName}>
                  {item.originalName}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {item.mimeType} · {(item.byteSize / 1024).toFixed(1)} KB
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href={`${API_BASE_URL}${item.previewUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold"
                  >
                    Abrir
                  </a>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard.writeText(item.id)}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold"
                  >
                    Copiar ID
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    className="rounded-lg border border-red-900 px-3 py-2 text-xs font-semibold text-red-300"
                  >
                    Remover
                  </button>
                </div>
                <MediaMetadataForm
                  item={item}
                  onSaved={() => void load()}
                  onError={(message) =>
                    setFeedback({
                      variant: 'error',
                      title: 'Não foi possível salvar os metadados.',
                      message,
                    })
                  }
                />
              </div>
            </article>
          ))}
        </div>
      </div>

      <AdminFeedbackModal
        open={Boolean(feedback)}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'success'}
        title={feedback?.title}
        message={feedback?.message ?? ''}
      />
    </>
  );
}

const metadataLocales = [
  ['pt-BR', 'PT_BR'],
  ['en', 'EN'],
  ['es', 'ES'],
] as const;

function MediaMetadataForm({
  item,
  onSaved,
  onError,
}: {
  item: AdminMediaItem;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const initial = Object.fromEntries(
    metadataLocales.map(([locale, prismaLocale]) => {
      const source = item.translations.find((entry) => entry.locale === prismaLocale);
      return [locale, { title: source?.title ?? '', altText: source?.altText ?? '' }];
    }),
  ) as Record<'pt-BR' | 'en' | 'es', { title: string; altText: string }>;
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await adminFetch(`/api/admin/media/${item.id}/translations`, {
        method: 'PATCH',
        body: JSON.stringify({
          translations: metadataLocales.map(([locale]) => ({
            locale,
            title: values[locale].title || null,
            altText: values[locale].altText || null,
          })),
        }),
      });
      onSaved();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Falha inesperada.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="mt-4 border-t border-slate-800 pt-4">
      <summary className="cursor-pointer text-xs font-semibold text-slate-300">
        Título e texto alternativo
      </summary>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {metadataLocales.map(([locale]) => (
          <fieldset key={locale} className="space-y-2">
            <legend className="text-xs font-bold text-slate-500">{locale}</legend>
            <input
              aria-label={`Título ${locale}`}
              placeholder="Título opcional"
              maxLength={180}
              value={values[locale].title}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [locale]: { ...current[locale], title: event.target.value },
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <input
              aria-label={`Texto alternativo ${locale}`}
              placeholder={item.kind === 'IMAGE' ? 'Descreva a imagem' : 'Descrição opcional'}
              maxLength={320}
              value={values[locale].altText}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [locale]: { ...current[locale], altText: event.target.value },
                }))
              }
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </fieldset>
        ))}
        <button
          disabled={saving}
          className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar metadados'}
        </button>
      </form>
    </details>
  );
}
