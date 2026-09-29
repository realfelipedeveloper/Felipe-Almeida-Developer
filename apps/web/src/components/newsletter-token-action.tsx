'use client';

import { useEffect, useRef, useState } from 'react';
import type { Locale } from '@/i18n/config';
import { SuccessModal } from './success-modal';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

const labels = {
  'pt-BR': {
    processing: 'Validando seu link…',
    confirmTitle: 'Confirmando inscrição',
    unsubscribeTitle: 'Cancelando inscrição',
    confirmEyebrow: 'INSCRIÇÃO CONFIRMADA',
    confirmSuccessTitle: 'Inscrição confirmada.',
    unsubscribeEyebrow: 'INSCRIÇÃO CANCELADA',
    unsubscribeSuccessTitle: 'Inscrição cancelada.',
    error: 'Não foi possível concluir a operação.',
  },
  en: {
    processing: 'Validating your link…',
    confirmTitle: 'Confirming subscription',
    unsubscribeTitle: 'Unsubscribing',
    confirmEyebrow: 'SUBSCRIPTION CONFIRMED',
    confirmSuccessTitle: 'Subscription confirmed.',
    unsubscribeEyebrow: 'SUBSCRIPTION CANCELLED',
    unsubscribeSuccessTitle: 'Subscription cancelled.',
    error: 'The operation could not be completed.',
  },
  es: {
    processing: 'Validando tu enlace…',
    confirmTitle: 'Confirmando suscripción',
    unsubscribeTitle: 'Cancelando suscripción',
    confirmEyebrow: 'SUSCRIPCIÓN CONFIRMADA',
    confirmSuccessTitle: 'Suscripción confirmada.',
    unsubscribeEyebrow: 'SUSCRIPCIÓN CANCELADA',
    unsubscribeSuccessTitle: 'Suscripción cancelada.',
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
  const [success, setSuccess] = useState(false);
  const copy = labels[locale];

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
              : value ?? copy.error,
          );
        }

        setMessage(
          typeof body?.message === 'string'
            ? body.message
            : action === 'confirm'
              ? copy.confirmSuccessTitle
              : copy.unsubscribeSuccessTitle,
        );
        setSuccess(true);
      } catch (cause) {
        setError(true);
        setMessage(
          cause instanceof Error ? cause.message : copy.error,
        );
      }
    })();
  }, [action, copy, token]);

  const successEyebrow =
    action === 'confirm'
      ? copy.confirmEyebrow
      : copy.unsubscribeEyebrow;

  const successTitle =
    action === 'confirm'
      ? copy.confirmSuccessTitle
      : copy.unsubscribeSuccessTitle;

  return (
    <>
      <section className="mx-auto max-w-2xl px-5 py-24">
        <div className="site-panel p-8 md:p-10">
          <p className="eyebrow">FELIPE.DEV / NEWSLETTER</p>
          <h1 className="display-title mt-4 text-4xl">
            {action === 'confirm'
              ? copy.confirmTitle
              : copy.unsubscribeTitle}
          </h1>

          {!success && !error ? (
            <p className="mt-7 text-sm leading-6 text-zinc-500" role="status">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="form-feedback is-error mt-7" role="alert">
              {message}
            </p>
          ) : null}
        </div>
      </section>

      <SuccessModal
        open={success}
        locale={locale}
        eyebrow={successEyebrow}
        title={successTitle}
        message={message}
        onClose={() => setSuccess(false)}
      />
    </>
  );
}
