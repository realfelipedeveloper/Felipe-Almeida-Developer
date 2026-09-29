'use client';

import { useEffect, useState } from 'react';
import {
  adminFetch,
  AdminApiError,
} from '@/lib/admin/admin-api';
import {
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

type ContactStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'SPAM';

type NewsletterStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'UNSUBSCRIBED'
  | 'BOUNCED';

interface ContactRow {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactStatus;
  createdAt: string;
}

interface SubscriberRow {
  id: string;
  email: string;
  status: NewsletterStatus;
  locale: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
}

type EngagementRow = ContactRow | SubscriberRow;

const contactStatuses: ContactStatus[] = [
  'NEW',
  'IN_PROGRESS',
  'RESOLVED',
  'SPAM',
];

const newsletterStatuses: NewsletterStatus[] = [
  'PENDING',
  'ACTIVE',
  'UNSUBSCRIBED',
  'BOUNCED',
];

function formatDate(value: string | null) {
  if (!value) return 'Não informado';
  return new Date(value).toLocaleString('pt-BR');
}

export function AdminEngagementList({
  kind,
}: {
  kind: 'contacts' | 'newsletter';
}) {
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] =
    useState<EngagementRow | null>(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  async function load() {
    setLoading(true);

    try {
      const data = await adminFetch<EngagementRow[]>(
        `/api/admin/engagement/${kind}`,
      );
      setRows(data);
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível carregar os dados.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível carregar os dados.',
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [kind]);

  function openRow(row: EngagementRow) {
    setSelected(row);
    setStatus(row.status);
  }

  async function saveStatus() {
    if (!selected) return;

    setSaving(true);

    try {
      await adminFetch(
        `/api/admin/engagement/${kind}/${selected.id}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        },
      );

      setSelected(null);
      await load();
      setFeedback({
        variant: 'success',
        title: 'Status atualizado.',
        message:
          kind === 'contacts'
            ? 'O status do contato foi atualizado com sucesso.'
            : 'O status do inscrito foi atualizado com sucesso.',
      });
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível atualizar o status.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível atualizar o status.',
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="text-sm text-zinc-500">Carregando…</p>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {!rows.length ? (
          <div className="site-panel p-6 text-sm text-zinc-500">
            Nenhum registro encontrado.
          </div>
        ) : null}

        {rows.map((row) => {
          if (kind === 'contacts') {
            const contact = row as ContactRow;

            return (
              <article
                key={contact.id}
                className="site-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="eyebrow">
                    {formatDate(contact.createdAt)}
                  </p>
                  <h2 className="mt-2 truncate text-lg font-bold">
                    {contact.subject}
                  </h2>
                  <p className="mt-1 truncate text-sm text-zinc-400">
                    {contact.name} · {contact.email}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-zinc-500">
                    Status: {contact.status}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openRow(contact)}
                  className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200"
                >
                  Visualizar
                </button>
              </article>
            );
          }

          const subscriber = row as SubscriberRow;

          return (
            <article
              key={subscriber.id}
              className="site-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {subscriber.email}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {subscriber.locale} ·{' '}
                  {formatDate(subscriber.createdAt)}
                </p>
                <p className="mt-2 text-xs font-semibold text-zinc-500">
                  Status: {subscriber.status}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openRow(subscriber)}
                className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-200"
              >
                Visualizar
              </button>
            </article>
          );
        })}
      </div>

      <AdminModal
        open={Boolean(selected)}
        onClose={() => {
          if (!saving) setSelected(null);
        }}
        eyebrow={
          kind === 'contacts'
            ? 'ADMIN / CONTATOS'
            : 'ADMIN / NEWSLETTER'
        }
        title={
          kind === 'contacts'
            ? 'Visualizar contato'
            : 'Visualizar inscrito'
        }
        description="Os dados e campos de manutenção deste registro ficam concentrados no modal."
        size="md"
        closeOnBackdrop={!saving}
        closeOnEscape={!saving}
      >
        {selected && kind === 'contacts' ? (
          <ContactFields
            contact={selected as ContactRow}
            status={status as ContactStatus}
            onStatusChange={setStatus}
          />
        ) : null}

        {selected && kind === 'newsletter' ? (
          <SubscriberFields
            subscriber={selected as SubscriberRow}
            status={status as NewsletterStatus}
            onStatusChange={setStatus}
          />
        ) : null}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => setSelected(null)}
            className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold disabled:opacity-50"
          >
            Fechar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void saveStatus()}
            className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
          >
            {saving ? 'Salvando…' : 'Salvar status'}
          </button>
        </div>
      </AdminModal>

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

function ContactFields({
  contact,
  status,
  onStatusChange,
}: {
  contact: ContactRow;
  status: ContactStatus;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ReadOnlyField label="Nome" value={contact.name} />
      <ReadOnlyField label="E-mail" value={contact.email} />
      <ReadOnlyField
        label="Assunto"
        value={contact.subject}
        full
      />
      <ReadOnlyField
        label="Recebido em"
        value={formatDate(contact.createdAt)}
      />

      <label className="text-sm font-semibold">
        Status
        <select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-normal"
        >
          {contactStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-semibold md:col-span-2">
        Mensagem
        <textarea
          readOnly
          rows={8}
          value={contact.message}
          className="mt-2 w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-normal leading-7 text-zinc-300"
        />
      </label>
    </div>
  );
}

function SubscriberFields({
  subscriber,
  status,
  onStatusChange,
}: {
  subscriber: SubscriberRow;
  status: NewsletterStatus;
  onStatusChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <ReadOnlyField
        label="E-mail"
        value={subscriber.email}
        full
      />
      <ReadOnlyField
        label="Idioma"
        value={subscriber.locale}
      />
      <ReadOnlyField
        label="Cadastro"
        value={formatDate(subscriber.createdAt)}
      />
      <ReadOnlyField
        label="Confirmação"
        value={formatDate(subscriber.confirmedAt)}
      />
      <ReadOnlyField
        label="Cancelamento"
        value={formatDate(subscriber.unsubscribedAt)}
      />

      <label className="text-sm font-semibold md:col-span-2">
        Status
        <select
          value={status}
          onChange={(event) =>
            onStatusChange(event.target.value)
          }
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-normal"
        >
          {newsletterStatuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  full = false,
}: {
  label: string;
  value: string;
  full?: boolean;
}) {
  return (
    <label
      className={`text-sm font-semibold ${
        full ? 'md:col-span-2' : ''
      }`}
    >
      {label}
      <input
        readOnly
        value={value}
        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-normal text-zinc-300"
      />
    </label>
  );
}
