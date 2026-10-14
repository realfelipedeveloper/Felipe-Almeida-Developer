'use client';

import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';
import { currentDateTimeLocal, localDateTimeToIso, toDateTimeLocal } from '@/lib/date-time-local';
import { AdminConfirmModal, AdminFeedbackModal, AdminModal } from './admin-modal';

type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
type Locale = 'pt-BR' | 'en' | 'es';

interface IssueTranslation {
  locale: 'PT_BR' | 'EN' | 'ES';
  subject: string;
  previewText: string | null;
  bodyHtml: string;
}

interface IssueRow {
  id: string;
  publicationStatus: PublicationStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  translations: IssueTranslation[];
}

interface TranslationForm {
  locale: Locale;
  subject: string;
  previewText: string;
  bodyHtml: string;
}

interface IssueForm {
  publicationStatus: PublicationStatus;
  scheduledAt: string;
  publishedAt: string;
  translations: TranslationForm[];
}

const localeMap = { 'pt-BR': 'PT_BR', en: 'EN', es: 'ES' } as const;

function emptyForm(): IssueForm {
  return {
    publicationStatus: 'DRAFT',
    scheduledAt: '',
    publishedAt: currentDateTimeLocal(),
    translations: (['pt-BR', 'en', 'es'] as const).map((locale) => ({
      locale,
      subject: '',
      previewText: '',
      bodyHtml: '',
    })),
  };
}

function toForm(issue: IssueRow): IssueForm {
  const form = emptyForm();
  return {
    publicationStatus: issue.publicationStatus,
    scheduledAt: issue.scheduledAt ? toDateTimeLocal(issue.scheduledAt) : '',
    publishedAt: issue.publishedAt ? toDateTimeLocal(issue.publishedAt) : '',
    translations: form.translations.map((item) => {
      const stored = issue.translations.find(
        (translation) => translation.locale === localeMap[item.locale],
      );
      return stored
        ? {
            ...item,
            subject: stored.subject,
            previewText: stored.previewText ?? '',
            bodyHtml: stored.bodyHtml,
          }
        : item;
    }),
  };
}

export function AdminNewsletterIssues() {
  const [issues, setIssues] = useState<IssueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null | undefined>(undefined);
  const [form, setForm] = useState<IssueForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<IssueRow | null>(null);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setIssues(await adminFetch<IssueRow[]>('/api/admin/engagement/newsletter/issues'));
    } catch (cause) {
      showError(cause, 'Não foi possível carregar as edições.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openNew() {
    setForm(emptyForm());
    setEditingId(null);
  }

  async function openEdit(id: string) {
    try {
      const issue = await adminFetch<IssueRow>(`/api/admin/engagement/newsletter/issues/${id}`);
      setForm(toForm(issue));
      setEditingId(id);
    } catch (cause) {
      showError(cause, 'Não foi possível carregar a edição.');
    }
  }

  function updateTranslation(locale: Locale, field: keyof TranslationForm, value: string) {
    setForm((current) => ({
      ...current,
      translations: current.translations.map((translation) =>
        translation.locale === locale ? { ...translation, [field]: value } : translation,
      ),
    }));
  }

  async function save() {
    if (form.publicationStatus === 'PUBLISHED' && !form.publishedAt) {
      setFeedback({
        variant: 'error',
        title: 'Data de publicação obrigatória.',
        message: 'Informe a data editorial antes de publicar a edição.',
      });
      return;
    }
    const translations = form.translations.filter(
      (translation) => translation.subject.trim() && translation.bodyHtml.trim(),
    );
    if (!translations.length) {
      setFeedback({
        variant: 'error',
        title: 'Tradução obrigatória.',
        message: 'Preencha assunto e conteúdo em pelo menos um idioma.',
      });
      return;
    }

    setSaving(true);
    try {
      const path = editingId
        ? `/api/admin/engagement/newsletter/issues/${editingId}`
        : '/api/admin/engagement/newsletter/issues';
      await adminFetch(path, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          publicationStatus: form.publicationStatus,
          scheduledAt: localDateTimeToIso(form.scheduledAt),
          publishedAt: localDateTimeToIso(form.publishedAt),
          translations: translations.map((translation) => ({
            ...translation,
            previewText: translation.previewText.trim() || null,
          })),
        }),
      });
      setEditingId(undefined);
      await load();
      setFeedback({
        variant: 'success',
        title: 'Edição salva.',
        message:
          form.publicationStatus === 'PUBLISHED'
            ? form.scheduledAt && new Date(form.scheduledAt).getTime() > Date.now()
              ? 'A edição foi autorizada e será enviada no horário agendado.'
              : 'A publicação foi registrada e a entrega assíncrona foi iniciada.'
            : 'A edição foi salva com sucesso.',
      });
    } catch (cause) {
      showError(cause, 'Não foi possível salvar a edição.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setSaving(true);
    try {
      await adminFetch(`/api/admin/engagement/newsletter/issues/${pendingDelete.id}`, {
        method: 'DELETE',
      });
      setPendingDelete(null);
      await load();
      setFeedback({
        variant: 'success',
        title: 'Edição excluída.',
        message: 'A edição foi removida com sucesso.',
      });
    } catch (cause) {
      showError(cause, 'Não foi possível excluir a edição.');
    } finally {
      setSaving(false);
    }
  }

  function showError(cause: unknown, fallback: string) {
    setFeedback({
      variant: 'error',
      title: fallback,
      message: cause instanceof AdminApiError || cause instanceof Error ? cause.message : fallback,
    });
  }

  return (
    <>
      <div className="mb-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Edições</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Crie, revise e publique campanhas multilíngues.
            </p>
          </div>
          <button
            type="button"
            onClick={openNew}
            className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-zinc-950"
          >
            Nova edição
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? <p className="text-sm text-zinc-500">Carregando edições…</p> : null}
          {!loading && !issues.length ? (
            <div className="site-panel p-6 text-sm text-zinc-500">Nenhuma edição cadastrada.</div>
          ) : null}
          {issues.map((issue) => {
            const translation =
              issue.translations.find((item) => item.locale === 'PT_BR') ?? issue.translations[0];
            return (
              <article
                key={issue.id}
                className="site-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-bold">{translation?.subject ?? 'Sem assunto'}</h3>
                  <p className="mt-1 text-xs text-zinc-500">
                    {issue.publicationStatus === 'PUBLISHED' &&
                    issue.scheduledAt &&
                    new Date(issue.scheduledAt).getTime() > Date.now()
                      ? 'AGENDADA'
                      : issue.publicationStatus}{' '}
                    · {new Date(issue.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="flex gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => void openEdit(issue.id)}
                    className="text-zinc-200"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(issue)}
                    className="text-red-300"
                  >
                    Excluir
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <AdminModal
        open={editingId !== undefined}
        onClose={() => {
          if (!saving) setEditingId(undefined);
        }}
        eyebrow="ADMIN / NEWSLETTER"
        title={editingId ? 'Editar edição' : 'Nova edição'}
        description="A publicação dispara a entrega assíncrona apenas para inscritos ativos."
        size="xl"
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Status
            <select
              value={form.publicationStatus}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  publicationStatus: event.target.value as PublicationStatus,
                }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
            >
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicada</option>
              <option value="ARCHIVED">Arquivada</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Agendamento
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, scheduledAt: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
            />
          </label>
          <label className="text-sm font-semibold">
            Publicação
            <input
              type="datetime-local"
              required={form.publicationStatus === 'PUBLISHED'}
              value={form.publishedAt}
              onChange={(event) =>
                setForm((current) => ({ ...current, publishedAt: event.target.value }))
              }
              className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
            />
          </label>
        </div>

        <div className="mt-6 space-y-6">
          {form.translations.map((translation) => (
            <fieldset key={translation.locale} className="rounded-2xl border border-zinc-800 p-4">
              <legend className="px-2 text-sm font-bold">{translation.locale}</legend>
              <div className="grid gap-4">
                <label className="text-sm font-semibold">
                  Assunto
                  <input
                    value={translation.subject}
                    maxLength={220}
                    onChange={(event) =>
                      updateTranslation(translation.locale, 'subject', event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Texto de prévia
                  <input
                    value={translation.previewText}
                    maxLength={320}
                    onChange={(event) =>
                      updateTranslation(translation.locale, 'previewText', event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Conteúdo HTML
                  <textarea
                    value={translation.bodyHtml}
                    rows={9}
                    onChange={(event) =>
                      updateTranslation(translation.locale, 'bodyHtml', event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-sm"
                  />
                </label>
              </div>
            </fieldset>
          ))}
        </div>

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => setEditingId(undefined)}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar edição'}
          </button>
        </div>
      </AdminModal>

      <AdminConfirmModal
        open={Boolean(pendingDelete)}
        onClose={() => {
          if (!saving) setPendingDelete(null);
        }}
        onConfirm={() => void remove()}
        title="Excluir edição?"
        message="A exclusão é definitiva. Entregas já publicadas não podem ser recuperadas."
        confirmLabel="Excluir definitivamente"
        danger
        busy={saving}
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
