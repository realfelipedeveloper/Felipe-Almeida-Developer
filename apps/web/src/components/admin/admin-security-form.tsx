'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminFetch,
  AdminApiError,
  type AdminIdentity,
} from '@/lib/admin/admin-api';
import {
  AdminConfirmModal,
  AdminFeedbackModal,
  AdminModal,
} from './admin-modal';

export function AdminSecurityForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [changeOpen, setChangeOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [canLogoutAll, setCanLogoutAll] = useState(false);
  const [feedback, setFeedback] = useState<{
    variant: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    adminFetch<{ admin: AdminIdentity }>('/api/admin/auth/me')
      .then(({ admin }) => {
        if (active) setCanLogoutAll(admin.role === 'SUPER_ADMIN');
      })
      .catch(() => {
        if (active) setCanLogoutAll(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (newPassword !== confirm) {
      setFeedback({
        variant: 'error',
        title: 'Confirmação de senha inválida.',
        message: 'A confirmação da nova senha não confere.',
      });
      return;
    }

    setBusy(true);

    try {
      await adminFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setChangeOpen(false);
      setFeedback({
        variant: 'success',
        title: 'Senha alterada.',
        message:
          'A senha foi atualizada e as sessões anteriores foram revogadas.',
      });
      router.refresh();
    } catch (cause) {
      setFeedback({
        variant: 'error',
        title: 'Não foi possível alterar a senha.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível alterar a senha.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function logoutAll() {
    setBusy(true);

    try {
      await adminFetch('/api/admin/auth/logout-all', {
        method: 'POST',
      });
      setLogoutOpen(false);
      router.replace('/admin/login');
      router.refresh();
    } catch (cause) {
      setLogoutOpen(false);
      setFeedback({
        variant: 'error',
        title: 'Não foi possível encerrar as sessões.',
        message:
          cause instanceof AdminApiError
            ? cause.message
            : 'Não foi possível encerrar todas as sessões.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="max-w-3xl">
        <p className="eyebrow">ADMIN / SEGURANÇA</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          Segurança
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Gerencie credenciais e sessões administrativas por meio de
          ações protegidas.
        </p>

        <div className={`mt-8 grid gap-4 ${canLogoutAll ? 'md:grid-cols-2' : ''}`}>
          <section className="site-panel p-6">
            <h2 className="text-xl font-bold">Senha administrativa</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Altere sua senha atual. A operação revoga as sessões
              anteriores.
            </p>
            <button
              type="button"
              onClick={() => setChangeOpen(true)}
              className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-zinc-950"
            >
              Alterar senha
            </button>
          </section>

          {canLogoutAll ? (
            <section className="site-panel p-6">
              <h2 className="text-xl font-bold">Sessões ativas</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Encerre todas as sessões administrativas quando houver
                necessidade de revogação global.
              </p>
              <button
                type="button"
                onClick={() => setLogoutOpen(true)}
                className="mt-5 rounded-xl border border-red-900 px-5 py-3 text-sm font-semibold text-red-300"
              >
                Encerrar todas as sessões
              </button>
            </section>
          ) : null}
        </div>
      </div>

      <AdminModal
        open={changeOpen}
        onClose={() => {
          if (!busy) setChangeOpen(false);
        }}
        eyebrow="ADMIN / SEGURANÇA"
        title="Alterar senha"
        description="Informe a senha atual e defina a nova credencial administrativa."
        size="sm"
        closeOnBackdrop={!busy}
        closeOnEscape={!busy}
      >
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-semibold">
            Senha atual
            <input
              type="password"
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(event.target.value)
              }
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <label className="block text-sm font-semibold">
            Nova senha
            <input
              type="password"
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              required
              minLength={4}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <label className="block text-sm font-semibold">
            Confirmar nova senha
            <input
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={4}
              autoComplete="new-password"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal"
            />
          </label>

          <p className="text-xs leading-5 text-slate-500">
            Use no mínimo 4 caracteres.
          </p>

          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => setChangeOpen(false)}
              className="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              disabled={busy}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-50"
            >
              {busy ? 'Alterando…' : 'Alterar senha'}
            </button>
          </div>
        </form>
      </AdminModal>

      <AdminConfirmModal
        open={logoutOpen}
        onClose={() => {
          if (!busy) setLogoutOpen(false);
        }}
        onConfirm={() => void logoutAll()}
        title="Encerrar todas as sessões?"
        message="Todas as sessões administrativas atuais serão revogadas, incluindo esta sessão."
        confirmLabel="Encerrar sessões"
        danger
        busy={busy}
      />

      <AdminFeedbackModal
        open={Boolean(feedback)}
        onClose={() => setFeedback(null)}
        variant={feedback?.variant ?? 'success'}
        title={feedback?.title}
        message={feedback?.message ?? ''}
      />
    </>
  );
}
