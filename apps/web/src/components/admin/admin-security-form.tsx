'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch, AdminApiError } from '@/lib/admin/admin-api';

export function AdminSecurityForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirm) {
      setError('A confirmação da nova senha não confere.');
      return;
    }
    try {
      await adminFetch('/api/admin/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      setMessage('Senha alterada e sessões anteriores revogadas.');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Não foi possível alterar a senha.');
    }
  }

  async function logoutAll() {
    await adminFetch('/api/admin/auth/logout-all', { method: 'POST' });
    router.replace('/admin/login');
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-4xl font-black tracking-tight">Segurança</h1>
      <p className="mt-2 text-slate-400">Troque a senha inicial e revogue sessões quando necessário.</p>
      <form onSubmit={submit} className="mt-8 space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        {[
          ['Senha atual', currentPassword, setCurrentPassword],
          ['Nova senha', newPassword, setNewPassword],
          ['Confirmar nova senha', confirm, setConfirm],
        ].map(([label, value, setter]) => (
          <label key={label as string} className="block text-sm font-semibold">
            {label as string}
            <input type="password" value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} required className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" />
          </label>
        ))}
        <p className="text-xs leading-5 text-slate-500">Use no mínimo 4 caracteres.</p>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        <button className="rounded-xl bg-white px-5 py-3 font-bold text-slate-950">Alterar senha</button>
      </form>
      <button type="button" onClick={logoutAll} className="mt-6 rounded-xl border border-red-900 px-5 py-3 font-semibold text-red-300">Encerrar todas as sessões</button>
    </div>
  );
}
