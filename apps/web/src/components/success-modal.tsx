'use client';

import { useEffect, useId, useRef } from 'react';
import type { Locale } from '@/i18n/config';

const closeLabels: Record<Locale, string> = {
  'pt-BR': 'Fechar',
  en: 'Close',
  es: 'Cerrar',
};

export function SuccessModal({
  open,
  locale,
  eyebrow,
  title,
  message,
  onClose,
}: {
  open: boolean;
  locale: Locale;
  eyebrow: string;
  title: string;
  message: string;
  onClose: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const closeLabel = closeLabels[locale];

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-5 py-8 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
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
                <path
                  d="m5 12 4 4L19 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
              aria-label={closeLabel}
            >
              <span aria-hidden="true" className="text-lg leading-none">
                ×
              </span>
            </button>
          </div>

          <p className="mt-7 font-mono text-[0.68rem] font-bold tracking-[0.18em] text-emerald-300/80">
            {eyebrow}
          </p>

          <h2
            id={titleId}
            className="mt-3 text-2xl font-bold tracking-[-0.035em] text-white sm:text-3xl"
          >
            {title}
          </h2>

          <p
            id={descriptionId}
            className="mt-4 text-sm leading-7 text-zinc-400"
          >
            {message}
          </p>

          <button
            type="button"
            onClick={onClose}
            className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition hover:-translate-y-0.5 hover:shadow-[0_14px_35px_rgba(255,255,255,.08)]"
          >
            {closeLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
