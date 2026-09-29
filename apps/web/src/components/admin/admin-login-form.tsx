'use client';

import {
  FormEvent,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  adminFetch,
  AdminApiError,
  type AdminIdentity,
} from '@/lib/admin/admin-api';
import {
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

type FeedbackState = {
  variant: 'success' | 'error' | 'info';
  title: string;
  message: string;
} | null;

export function AdminLoginForm() {
  const [email, setEmail] =
    useState('');
  const [password, setPassword] =
    useState('');
  const [loading, setLoading] =
    useState(false);
  const [recoveryOpen, setRecoveryOpen] =
    useState(false);
  const [recoveryEmail, setRecoveryEmail] =
    useState('');
  const [
    recoveryLoading,
    setRecoveryLoading,
  ] = useState(false);
  const [feedback, setFeedback] =
    useState<FeedbackState>(null);

  const router = useRouter();

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setLoading(true);
    setFeedback(null);

    try {
      const result =
        await adminFetch<{
          admin: AdminIdentity;
        }>(
          '/api/admin/auth/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email,
              password,
            }),
          },
        );

      router.replace(
        result.admin.mustChangePassword
          ? '/admin/seguranca'
          : '/admin',
      );
      router.refresh();
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Acesso não autorizado.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível entrar no painel.',
      });
    } finally {
      setLoading(false);
    }
  }

  function openRecovery() {
    setRecoveryEmail(email);
    setRecoveryOpen(true);
  }

  async function requestRecovery(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setRecoveryLoading(true);
    setFeedback(null);

    try {
      const result =
        await adminFetch<{
          message: string;
        }>(
          '/api/admin/auth/forgot-password',
          {
            method: 'POST',
            body: JSON.stringify({
              email: recoveryEmail,
            }),
          },
        );

      setRecoveryOpen(false);
      setFeedback({
        variant: 'info',
        title:
          'Solicitação recebida.',
        message: result.message,
      });
    } catch (cause) {
      setRecoveryOpen(false);
      setFeedback({
        variant: 'error',
        title:
          'Não foi possível solicitar a recuperação.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível solicitar a recuperação de senha.',
      });
    } finally {
      setRecoveryLoading(false);
    }
  }

  return (
    <>
      <form
        onSubmit={submit}
        className="mt-8 space-y-5"
      >
        <label className="block text-sm font-semibold">
          E-mail
          <input
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            type="email"
            required
            autoComplete="username"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
          />
        </label>

        <label className="block text-sm font-semibold">
          Senha
          <input
            value={password}
            onChange={(event) =>
              setPassword(
                event.target.value,
              )
            }
            type="password"
            required
            autoComplete="current-password"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
          />
        </label>

        <button
          type="button"
          onClick={openRecovery}
          className="text-left text-sm text-zinc-400 underline decoration-zinc-700 underline-offset-4 transition hover:text-white"
        >
          Esqueceu sua senha? Clique aqui
          para recuperá-la
        </button>

        <button
          disabled={loading}
          className="w-full rounded-xl bg-white px-4 py-3 font-bold text-slate-950 disabled:opacity-60"
        >
          {loading
            ? 'Entrando…'
            : 'Entrar'}
        </button>
      </form>

      <AdminModal
        open={recoveryOpen}
        onClose={() => {
          if (!recoveryLoading) {
            setRecoveryOpen(false);
          }
        }}
        eyebrow="ADMIN / RECUPERAÇÃO"
        title="Recuperar senha"
        description="Informe o e-mail da conta administrativa. Por segurança, a resposta não informa se a conta existe."
        size="sm"
        closeOnBackdrop={
          !recoveryLoading
        }
        closeOnEscape={
          !recoveryLoading
        }
      >
        <form
          onSubmit={requestRecovery}
          className="space-y-5"
        >
          <label className="block text-sm font-semibold">
            E-mail
            <input
              value={recoveryEmail}
              onChange={(event) =>
                setRecoveryEmail(
                  event.target.value,
                )
              }
              type="email"
              required
              autoComplete="email"
              autoFocus
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={recoveryLoading}
              onClick={() =>
                setRecoveryOpen(false)
              }
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              disabled={recoveryLoading}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {recoveryLoading
                ? 'Enviando…'
                : 'Enviar recuperação'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminFeedbackModal
        open={Boolean(feedback)}
        onClose={() =>
          setFeedback(null)
        }
        variant={
          feedback?.variant ?? 'info'
        }
        title={feedback?.title}
        message={
          feedback?.message ?? ''
        }
      />
    </>
  );
}
