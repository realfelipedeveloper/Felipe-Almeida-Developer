'use client';

import { type FormEvent, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { SuccessModal } from './success-modal';
import { resetTurnstile, TurnstileWidget } from './turnstile-widget';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface PrivacyRequestLabels {
  title: string;
  description: string;
  email: string;
  type: string;
  exportOption: string;
  deleteOption: string;
  deleteWarning: string;
  submit: string;
  sending: string;
  successEyebrow: string;
  successTitle: string;
  successFallback: string;
  errorFallback: string;
}

export function PrivacyRequestForm({
  locale,
  labels,
}: {
  locale: Locale;
  labels: PrivacyRequestLabels;
}) {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [requestType, setRequestType] = useState<'EXPORT' | 'DELETE'>('EXPORT');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLoading(true);
    setFeedback('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/privacy/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email: String(form.get('email') ?? ''),
          type: requestType,
          locale,
          website: String(form.get('website') ?? ''),
          turnstileToken: String(form.get('cf-turnstile-response') ?? ''),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        message?: string | string[];
      } | null;
      if (!response.ok) {
        const message = body?.message;
        throw new Error(
          Array.isArray(message) ? message.join(' ') : (message ?? labels.errorFallback),
        );
      }
      setSuccessMessage(typeof body?.message === 'string' ? body.message : labels.successFallback);
      formElement.reset();
      setRequestType('EXPORT');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : labels.errorFallback);
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  }

  return (
    <>
      <section className="site-panel p-6 sm:p-8" aria-labelledby="privacy-request-title">
        <h2
          id="privacy-request-title"
          className="text-2xl font-black text-zinc-950 dark:text-white"
        >
          {labels.title}
        </h2>
        <p className="mt-3 max-w-3xl leading-7 text-zinc-600 dark:text-zinc-300">
          {labels.description}
        </p>

        <form onSubmit={submit} className="form-stack mt-7">
          <label className="field-label">
            {labels.email}
            <input
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              className="field-control mt-2"
            />
          </label>

          <fieldset>
            <legend className="field-label">{labels.type}</legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['EXPORT', labels.exportOption],
                  ['DELETE', labels.deleteOption],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="site-panel flex cursor-pointer items-center gap-3 p-4"
                >
                  <input
                    type="radio"
                    name="type"
                    value={value}
                    checked={requestType === value}
                    onChange={() => setRequestType(value)}
                  />
                  <span className="font-semibold">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {requestType === 'DELETE' ? (
            <p className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-800 dark:text-amber-200">
              {labels.deleteWarning}
            </p>
          ) : null}

          <label className="honeypot" aria-hidden="true">
            Website
            <input name="website" tabIndex={-1} autoComplete="off" />
          </label>
          <TurnstileWidget />

          {feedback ? (
            <p className="form-feedback is-error" role="alert">
              {feedback}
            </p>
          ) : null}
          <button type="submit" disabled={loading} className="btn-primary w-fit">
            {loading ? labels.sending : labels.submit}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </section>

      <SuccessModal
        open={Boolean(successMessage)}
        locale={locale}
        eyebrow={labels.successEyebrow}
        title={labels.successTitle}
        message={successMessage || labels.successFallback}
        onClose={() => setSuccessMessage('')}
      />
    </>
  );
}
