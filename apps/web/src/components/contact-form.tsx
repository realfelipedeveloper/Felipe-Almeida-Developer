'use client';

import { FormEvent, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { SuccessModal } from './success-modal';
import {
  resetTurnstile,
  TurnstileWidget,
} from './turnstile-widget';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Labels {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
}

const successModalCopy: Record<
  Locale,
  { eyebrow: string; title: string; message: string }
> = {
  'pt-BR': {
    eyebrow: 'MENSAGEM ENVIADA',
    title: 'Recebi sua mensagem.',
    message: 'Obrigado pelo contato. Retornarei assim que possível.',
  },
  en: {
    eyebrow: 'MESSAGE SENT',
    title: 'I received your message.',
    message: 'Thanks for reaching out. I will get back to you as soon as possible.',
  },
  es: {
    eyebrow: 'MENSAJE ENVIADO',
    title: 'Recibí tu mensaje.',
    message: 'Gracias por contactarme. Te responderé lo antes posible.',
  },
};

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
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const modalCopy = successModalCopy[locale];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = event.currentTarget;

    setLoading(true);
    setFeedback('');
    setError(false);
    setShowSuccessModal(false);

    const form = new FormData(target);
    const payload = {
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      subject: String(form.get('subject') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
      turnstileToken: String(
        form.get('cf-turnstile-response') ?? '',
      ),
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

      target.reset();
      setShowSuccessModal(true);
    } catch (cause) {
      setError(true);
      setFeedback(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível enviar a mensagem.',
      );
    } finally {
      resetTurnstile();
      setLoading(false);
    }
  }

  return (
    <>
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

        <TurnstileWidget />

        {feedback && error ? (
          <p className="form-feedback is-error" role="alert">
            {feedback}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full sm:w-auto"
        >
          {loading ? '…' : labels.send}
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      <SuccessModal
        open={showSuccessModal}
        locale={locale}
        eyebrow={modalCopy.eyebrow}
        title={modalCopy.title}
        message={modalCopy.message}
        onClose={() => setShowSuccessModal(false)}
      />
    </>
  );
}
