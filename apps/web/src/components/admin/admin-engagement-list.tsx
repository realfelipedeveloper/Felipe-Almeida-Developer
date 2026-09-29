'use client';

import { useEffect, useState } from 'react';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';

type ContactStatus = 'NEW' | 'IN_PROGRESS' | 'RESOLVED' | 'SPAM';
type NewsletterStatus = 'PENDING' | 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED';

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

export function AdminEngagementList({
  kind,
}: {
  kind: 'contacts' | 'newsletter';
}) {
  const [rows, setRows] = useState<Array<ContactRow | SubscriberRow>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetch<Array<ContactRow | SubscriberRow>>(
        `/api/admin/engagement/${kind}`,
      );
      setRows(data);
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : 'Não foi possível carregar os dados.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [kind]);

  async function updateStatus(id: string, status: string) {
    try {
      await adminFetch(`/api/admin/engagement/${kind}/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : 'Não foi possível atualizar o status.',
      );
    }
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Carregando…</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {!rows.length ? (
        <div className="site-panel p-6 text-sm text-zinc-500">
          Nenhum registro encontrado.
        </div>
      ) : null}

      {rows.map((row) => {
        if (kind === 'contacts') {
          const contact = row as ContactRow;
          return (
            <article key={contact.id} className="site-panel p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="eyebrow">
                    {new Date(contact.createdAt).toLocaleString('pt-BR')}
                  </p>
                  <h2 className="mt-3 text-lg font-bold">{contact.subject}</h2>
                  <p className="mt-1 text-sm text-zinc-400">
                    {contact.name} · {contact.email}
                  </p>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
                    {contact.message}
                  </p>
                </div>

                <select
                  value={contact.status}
                  onChange={(event) =>
                    void updateStatus(contact.id, event.target.value)
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
                >
                  {contactStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          );
        }

        const subscriber = row as SubscriberRow;
        return (
          <article key={subscriber.id} className="site-panel p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{subscriber.email}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {subscriber.locale} ·{' '}
                  {new Date(subscriber.createdAt).toLocaleString('pt-BR')}
                </p>
              </div>

              <select
                value={subscriber.status}
                onChange={(event) =>
                  void updateStatus(subscriber.id, event.target.value)
                }
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs"
              >
                {newsletterStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </article>
        );
      })}
    </div>
  );
}
