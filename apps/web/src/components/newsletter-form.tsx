'use client';

import { FormEvent, useState } from 'react';
import type { Locale } from '@/i18n/config';
import {
  resetTurnstile,
  TurnstileWidget,
} from './turnstile-widget';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export function NewsletterForm({
  locale,
  emailLabel,
  submitLabel,
}: {
  locale: Locale;
  emailLabel: string;
  submitLabel: string;
}) {
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;

    setLoading(true);
    setFeedback('');
    setError(false);

    const form = new FormData(target);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/newsletter/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            email: String(form.get('email') ?? ''),
            website: String(form.get('website') ?? ''),
            turnstileToken: String(
              form.get('cf-turnstile-response') ?? '',
            ),
            locale,
          }),
        },
      );

      const body = (await response.json().catch(() => null)) as
        | { message?: string | string[] }
        | null;

      if (!response.ok) {
        const message = body?.message;
        throw new Error(
          Array.isArray(message)
            ? message.join(' ')
            : message ?? 'Não foi possível concluir a inscrição.',
        );
      }

      setFeedback(
        typeof body?.message === 'string'
          ? body.message
          : 'Confira seu e-mail para confirmar a inscrição.',
      );
      target.reset();
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível concluir a inscrição.',
      );
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="form-stack">
      <label className="field-label">
        {emailLabel}
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            className="field-control flex-1"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn-primary shrink-0"
          >
            {loading ? '…' : submitLabel}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </label>

      <label className="honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <TurnstileWidget />

      {feedback ? (
        <p
          className={
            error
              ? 'form-feedback is-error'
              : 'form-feedback is-success'
          }
        >
          {feedback}
        </p>
      ) : null}
    </form>
  );
}
