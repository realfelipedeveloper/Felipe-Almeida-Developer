'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
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
  { eyebrow: string; title: string; message: string; close: string }
> = {
  'pt-BR': {
    eyebrow: 'MENSAGEM ENVIADA',
    title: 'Recebi sua mensagem.',
    message: 'Obrigado pelo contato. Retornarei assim que possível.',
    close: 'Fechar',
  },
  en: {
    eyebrow: 'MESSAGE SENT',
    title: 'I received your message.',
    message: 'Thanks for reaching out. I will get back to you as soon as possible.',
    close: 'Close',
  },
  es: {
    eyebrow: 'MENSAJE ENVIADO',
    title: 'Recibí tu mensaje.',
    message: 'Gracias por contactarme. Te responderé lo antes posible.',
    close: 'Cerrar',
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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalCopy = successModalCopy[locale];

  useEffect(() => {
    if (!showSuccessModal) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowSuccessModal(false);
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [showSuccessModal]);

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

      {showSuccessModal ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-5 py-8 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowSuccessModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-success-title"
            aria-describedby="contact-success-description"
            className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111113]/95 p-7 shadow-[0_30px_120px_rgba(0,0,0,.65)] backdrop-blur-2xl sm:p-8"
          >
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-emerald-400/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="flex items-start justify-between gap-5">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-300 shadow-[0_0_30px_rgba(52,211,153,.10)]">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setShowSuccessModal(false)}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
                  aria-label={modalCopy.close}
                >
                  <span aria-hidden="true" className="text-lg leading-none">×</span>
                </button>
              </div>

              <p className="mt-7 font-mono text-[0.68rem] font-bold tracking-[0.18em] text-emerald-300/80">
                {modalCopy.eyebrow}
              </p>

              <h2
                id="contact-success-title"
                className="mt-3 text-2xl font-bold tracking-[-0.035em] text-white sm:text-3xl"
              >
                {modalCopy.title}
              </h2>

              <p
                id="contact-success-description"
                className="mt-4 text-sm leading-7 text-zinc-400"
              >
                {modalCopy.message}
              </p>

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(255,255,255,.08)]"
              >
                {modalCopy.close}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
