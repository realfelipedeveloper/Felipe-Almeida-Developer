'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const labels = {
  'pt-BR': {
    processing: 'Validando seu link…',
    confirmTitle: 'Confirmando inscrição',
    unsubscribeTitle: 'Cancelando inscrição',
    error: 'Não foi possível concluir a operação.',
  },
  en: {
    processing: 'Validating your link…',
    confirmTitle: 'Confirming subscription',
    unsubscribeTitle: 'Unsubscribing',
    error: 'The operation could not be completed.',
  },
  es: {
    processing: 'Validando tu enlace…',
    confirmTitle: 'Confirmando suscripción',
    unsubscribeTitle: 'Cancelando suscripción',
    error: 'No se pudo completar la operación.',
  },
} as const;

export function NewsletterTokenAction({
  locale,
  token,
  action,
}: {
  locale: Locale;
  token: string;
  action: 'confirm' | 'unsubscribe';
}) {
  const started = useRef(false);
  const [message, setMessage] = useState<string>(labels[locale].processing);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/newsletter/${action}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ token }),
          },
        );

        const body = (await response.json().catch(() => null)) as
          | { message?: string | string[] }
          | null;

        if (!response.ok) {
          const value = body?.message;
          throw new Error(
            Array.isArray(value)
              ? value.join(' ')
              : value ?? labels[locale].error,
          );
        }

        setMessage(
          typeof body?.message === 'string'
            ? body.message
            : labels[locale].processing,
        );
      } catch (cause) {
        setError(true);
        setMessage(
          cause instanceof Error ? cause.message : labels[locale].error,
        );
      }
    })();
  }, [action, locale, token]);

  return (
    <section className="mx-auto max-w-2xl px-5 py-24">
      <div className="site-panel p-8 md:p-10">
        <p className="eyebrow">FELIPE.DEV / NEWSLETTER</p>
        <h1 className="display-title mt-4 text-4xl">
          {action === 'confirm'
            ? labels[locale].confirmTitle
            : labels[locale].unsubscribeTitle}
        </h1>
        <p
          className={
            error
              ? 'form-feedback is-error mt-7'
              : 'form-feedback is-success mt-7'
          }
        >
          {message}
        </p>
      </div>
    </section>
  );
}
