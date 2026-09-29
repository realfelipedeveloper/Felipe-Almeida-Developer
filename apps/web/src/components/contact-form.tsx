'use client';

import { FormEvent, useState } from 'react';
import type { Locale } from '@/i18n/config';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Labels {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
}

export function ContactForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: Labels;
}) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFeedback('');
    setError(false);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      subject: String(form.get('subject') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
      locale,
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;

      if (!response.ok) {
        const message = body?.message;
        throw new Error(
          Array.isArray(message)
            ? message.join(' ')
            : message ?? 'Não foi possível enviar a mensagem.',
        );
      }

      setFeedback(
        typeof body?.message === 'string'
          ? body.message
          : 'Mensagem enviada com sucesso.',
      );
      event.currentTarget.reset();
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível enviar a mensagem.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-stack">
      <div className="grid gap-5 md:grid-cols-2">
        <label className="field-label">
          {labels.name}
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            autoComplete="name"
            className="field-control"
          />
        </label>

        <label className="field-label">
          {labels.email}
          <input
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            className="field-control"
          />
        </label>
      </div>

      <label className="field-label">
        {labels.subject}
        <input
          name="subject"
          required
          minLength={2}
          maxLength={200}
          className="field-control"
        />
      </label>

      <label className="field-label">
        {labels.message}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={7}
          className="field-control resize-y"
        />
      </label>

      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {feedback ? (
        <p className={error ? 'form-feedback is-error' : 'form-feedback is-success'}>
          {feedback}
        </p>
      ) : null}

      <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto">
        {loading ? '…' : labels.send}
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}
