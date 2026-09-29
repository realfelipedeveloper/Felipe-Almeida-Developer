'use client';

import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
} from 'react';

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
};

export function AdminModal({
  open,
  onClose,
  eyebrow = 'FELIPE.DEV / ADMIN',
  title,
  description,
  size = 'md',
  children,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  description?: string;
  size?: ModalSize;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && closeOnEscape) {
        onCloseRef.current();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [closeOnEscape, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center bg-black/75 px-4 py-6 backdrop-blur-md"
      role="presentation"
      onMouseDown={(event) => {
        if (
          closeOnBackdrop &&
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`flex max-h-[92vh] w-full ${sizeClasses[size]} flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111113]/98 shadow-[0_35px_140px_rgba(0,0,0,.72)]`}
      >
        <header className="flex shrink-0 items-start justify-between gap-5 border-b border-white/[0.07] px-6 py-5 sm:px-7">
          <div className="min-w-0">
            <p className="eyebrow">{eyebrow}</p>
            <h2
              id={titleId}
              className="mt-2 text-2xl font-bold tracking-[-0.035em] text-white sm:text-3xl"
            >
              {title}
            </h2>
            {description ? (
              <p
                id={descriptionId}
                className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400"
              >
                {description}
              </p>
            ) : null}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Fechar modal"
          >
            <span aria-hidden="true" className="text-xl leading-none">
              ×
            </span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-7">
          {children}
        </div>
      </section>
    </div>
  );
}

export function AdminFeedbackModal({
  open,
  onClose,
  variant,
  title,
  message,
}: {
  open: boolean;
  onClose: () => void;
  variant: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}) {
  const defaults = {
    success: {
      eyebrow: 'AÇÃO CONCLUÍDA',
      title: 'Tudo certo.',
      icon: '✓',
      iconClass:
        'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
    },
    error: {
      eyebrow: 'NÃO FOI POSSÍVEL CONCLUIR',
      title: 'Ocorreu um problema.',
      icon: '!',
      iconClass:
        'border-red-400/20 bg-red-400/10 text-red-300',
    },
    info: {
      eyebrow: 'INFORMAÇÃO',
      title: 'Atenção.',
      icon: 'i',
      iconClass:
        'border-zinc-400/20 bg-zinc-400/10 text-zinc-200',
    },
  } as const;

  const copy = defaults[variant];

  return (
    <AdminModal
      open={open}
      onClose={onClose}
      eyebrow={copy.eyebrow}
      title={title ?? copy.title}
      size="sm"
    >
      <div
        className={`grid h-12 w-12 place-items-center rounded-2xl border text-lg font-black ${copy.iconClass}`}
        aria-hidden="true"
      >
        {copy.icon}
      </div>

      <p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-zinc-300">
        {message}
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 transition hover:-translate-y-0.5"
      >
        Fechar
      </button>
    </AdminModal>
  );
}

export function AdminConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <AdminModal
      open={open}
      onClose={onClose}
      eyebrow={danger ? 'CONFIRMAÇÃO NECESSÁRIA' : 'CONFIRMAR AÇÃO'}
      title={title}
      size="sm"
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
    >
      <p className="text-sm leading-7 text-zinc-300">{message}</p>

      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="min-h-11 rounded-xl border border-zinc-700 px-5 text-sm font-semibold text-zinc-200 disabled:opacity-50"
        >
          {cancelLabel}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={onConfirm}
          className={
            danger
              ? 'min-h-11 rounded-xl bg-red-500 px-5 text-sm font-bold text-white disabled:opacity-50'
              : 'min-h-11 rounded-xl bg-white px-5 text-sm font-bold text-zinc-950 disabled:opacity-50'
          }
        >
          {busy ? 'Processando…' : confirmLabel}
        </button>
      </div>
    </AdminModal>
  );
}
