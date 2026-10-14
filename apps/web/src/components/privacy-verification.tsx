'use client';

import { useEffect, useRef, useState } from 'react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface PrivacyVerificationLabels {
  processing: string;
  exportReady: string;
  deletionComplete: string;
  download: string;
  invalid: string;
  confirmTitle: string;
  confirmDescription: string;
  confirmAction: string;
}

type Status = 'processing' | 'confirm-delete' | 'export' | 'deleted' | 'error';

export function PrivacyVerification({ labels }: { labels: PrivacyVerificationLabels }) {
  const started = useRef(false);
  const objectUrl = useRef('');
  const [status, setStatus] = useState<Status>('processing');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [confirmationToken, setConfirmationToken] = useState('');
  const [message, setMessage] = useState('');

  async function execute(activeToken: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/privacy/requests/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ token: activeToken }),
      });
      const body = (await response.json().catch(() => null)) as {
        type?: 'EXPORT' | 'DELETE';
        data?: unknown;
        message?: string | string[];
        confirmationRequired?: boolean;
        confirmationToken?: string;
      } | null;
      if (!response.ok || !body?.type) {
        const apiMessage = body?.message;
        throw new Error(
          Array.isArray(apiMessage) ? apiMessage.join(' ') : (apiMessage ?? labels.invalid),
        );
      }
      if (
        body.type === 'DELETE' &&
        body.confirmationRequired &&
        typeof body.confirmationToken === 'string'
      ) {
        setConfirmationToken(body.confirmationToken);
        setStatus('confirm-delete');
        return;
      }
      if (body.type === 'EXPORT') {
        objectUrl.current = URL.createObjectURL(
          new Blob([JSON.stringify(body.data, null, 2)], { type: 'application/json' }),
        );
        setDownloadUrl(objectUrl.current);
        setStatus('export');
        return;
      }
      setMessage(typeof body.message === 'string' ? body.message : labels.deletionComplete);
      setConfirmationToken('');
      setStatus('deleted');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.invalid);
      setConfirmationToken('');
      setStatus('error');
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '';
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setStatus('error');
      setMessage(labels.invalid);
      return;
    }
    void execute(token);
    // O token é lido uma única vez; execute não deve reiniciar ao re-renderizar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  return (
    <section className="site-panel mx-auto max-w-2xl p-7 text-center sm:p-10" aria-live="polite">
      {status === 'processing' ? <p>{labels.processing}</p> : null}
      {status === 'confirm-delete' ? (
        <>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white">
            {labels.confirmTitle}
          </h1>
          <p className="mt-4 leading-7 text-zinc-600 dark:text-zinc-300">
            {labels.confirmDescription}
          </p>
          <button
            type="button"
            className="btn-primary mt-7"
            onClick={() => {
              const token = confirmationToken;
              setStatus('processing');
              setConfirmationToken('');
              void execute(token);
            }}
          >
            {labels.confirmAction}
          </button>
        </>
      ) : null}
      {status === 'export' ? (
        <>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white">
            {labels.exportReady}
          </h1>
          <a href={downloadUrl} download="dados-pessoais.json" className="btn-primary mt-7">
            {labels.download}
          </a>
        </>
      ) : null}
      {status === 'deleted' ? (
        <>
          <h1 className="text-3xl font-black text-zinc-950 dark:text-white">
            {labels.deletionComplete}
          </h1>
          <p className="mt-4 leading-7 text-zinc-600 dark:text-zinc-300">{message}</p>
        </>
      ) : null}
      {status === 'error' ? (
        <p className="form-feedback is-error" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  );
}
