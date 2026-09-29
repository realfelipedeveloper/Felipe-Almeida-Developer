'use client';

import {
  FormEvent,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  adminFetch,
  AdminApiError,
} from '@/lib/admin/admin-api';
import {
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

export function AdminPasswordResetForm({
  token,
}: {
  token: string;
}) {
  const router = useRouter();
  const [newPassword, setNewPassword] =
    useState('');
  const [confirm, setConfirm] =
    useState('');
  const [saving, setSaving] =
    useState(false);
  const [success, setSuccess] =
    useState(false);
  const [error, setError] =
    useState('');

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError('');

    if (!token) {
      setError(
        'O link de recuperação é inválido ou está incompleto.',
      );
      return;
    }

    if (newPassword !== confirm) {
      setError(
        'A confirmação da nova senha não confere.',
      );
      return;
    }

    setSaving(true);

    try {
      await adminFetch<{
        message: string;
      }>(
        '/api/admin/auth/reset-password',
        {
          method: 'POST',
          body: JSON.stringify({
            token,
            newPassword,
          }),
        },
      );

      setSuccess(true);
    } catch (cause) {
      setError(
        cause instanceof AdminApiError
          ? cause.message
          : 'Não foi possível redefinir a senha.',
      );
    } finally {
      setSaving(false);
    }
  }

  function goToLogin() {
    router.replace('/admin/login');
  }

  return (
    <>
      <AdminModal
        open
        onClose={goToLogin}
        eyebrow="ADMIN / RECUPERAÇÃO"
        title="Redefinir senha"
        description="Defina uma nova senha para a conta administrativa. O link de recuperação expira em 30 minutos e pode ser utilizado apenas uma vez."
        size="sm"
        closeOnBackdrop={false}
        closeOnEscape={false}
      >
        <form
          onSubmit={submit}
          className="space-y-5"
        >
          <label className="block text-sm font-semibold">
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(
                  event.target.value,
                )
              }
              required
              minLength={4}
              maxLength={128}
              autoComplete="new-password"
              autoFocus
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <label className="block text-sm font-semibold">
            Confirmar nova senha
            <input
              type="password"
              value={confirm}
              onChange={(event) =>
                setConfirm(
                  event.target.value,
                )
              }
              required
              minLength={4}
              maxLength={128}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <p className="text-xs leading-5 text-zinc-500">
            Use no mínimo 4 caracteres.
          </p>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={goToLogin}
              className="rounded-xl border border-zinc-700 px-5 py-3 text-sm font-semibold text-zinc-200 disabled:opacity-50"
            >
              Voltar ao login
            </button>

            <button
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {saving
                ? 'Redefinindo…'
                : 'Redefinir senha'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminFeedbackModal
        open={Boolean(error)}
        onClose={() => setError('')}
        variant="error"
        title="Não foi possível redefinir a senha."
        message={error}
      />

      <AdminFeedbackModal
        open={success}
        onClose={goToLogin}
        variant="success"
        title="Senha redefinida."
        message="Sua senha foi alterada com sucesso. Entre novamente utilizando a nova senha."
      />
    </>
  );
}
