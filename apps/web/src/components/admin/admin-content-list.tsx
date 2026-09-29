'use client';

import { useEffect, useState } from 'react';
import {
  adminFetch,
  AdminApiError,
} from '@/lib/admin/admin-api';
import { AdminContentEditor } from './admin-content-editor';
import {
  AdminConfirmModal,
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

interface TranslationRow {
  locale: string;
  title: string;
  slug: string;
}

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
  const [editor, setEditor] = useState<{
    id?: string;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);

    try {
      setItems(
        await adminFetch<ContentRow[]>(
          `/api/admin/content/${kind}`,
        ),
      );
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Falha ao carregar conteúdo.',
        message:
          cause instanceof Error
            ? cause.message
            : 'Falha ao carregar conteúdo.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [kind]);

  async function remove() {
    if (!pendingDelete) return;

    setDeleting(true);

    try {
      await adminFetch(
        `/api/admin/content/${kind}/${pendingDelete.id}`,
        { method: 'DELETE' },
      );

      const removedName = pendingDelete.name;
      setPendingDelete(null);
      await load();

      setFeedback({
        variant: 'success',
        title: `${singular} excluído.`,
        message: `“${removedName}” foi removido com sucesso.`,
      });
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: `Não foi possível excluir ${singular.toLowerCase()}.`,
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Falha ao excluir conteúdo.',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">
              {title}
            </h1>
            <p className="mt-2 text-slate-400">
              Visualize, crie, edite, publique e remova conteúdo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setEditor({})}
            className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950"
          >
            Novo {singular.toLowerCase()}
          </button>
        </div>

        {loading ? (
          <p className="mt-8 text-slate-400">
            Carregando…
          </p>
        ) : (
          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-800">
            <div className="divide-y divide-slate-800">
              {items.length ? (
                items.map((item) => {
                  const pt =
                    item.translations.find(
                      (translation) =>
                        translation.locale === 'PT_BR',
                    ) ?? item.translations[0];

                  return (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 px-5 py-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold">
                          {pt?.title ?? 'Sem título'}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.publicationStatus} ·{' '}
                          {pt?.slug ?? '-'}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-3 text-sm">
                        <button
                          type="button"
                          onClick={() =>
                            setEditor({ id: item.id })
                          }
                          className="text-slate-200 hover:text-white"
                        >
                          Visualizar / editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setPendingDelete({
                              id: item.id,
                              name:
                                pt?.title ?? singular,
                            })
                          }
                          className="text-red-300"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="bg-slate-900 px-5 py-8 text-sm text-slate-500">
                  Nenhum conteúdo cadastrado.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <AdminModal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        eyebrow="ADMIN / CONTEÚDO"
        title={
          editor?.id
            ? `Visualizar / editar ${singular.toLowerCase()}`
            : `Novo ${singular.toLowerCase()}`
        }
        description="Os campos de manutenção ficam concentrados neste modal."
        size="xl"
      >
        {editor ? (
          <AdminContentEditor
            kind={kind}
            id={editor.id}
            embedded
            onCancel={() => setEditor(null)}
            onSaved={async () => {
              setEditor(null);
              await load();
            }}
          />
        ) : null}
      </AdminModal>

      <AdminConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void remove()}
        title={`Excluir ${singular.toLowerCase()}?`}
        message={
          pendingDelete
            ? `A exclusão de “${pendingDelete.name}” é definitiva e não poderá ser desfeita.`
            : ''
        }
        confirmLabel="Excluir definitivamente"
        danger
        busy={deleting}
      />

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
