'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch, AdminApiError, type AdminIdentity } from '@/lib/admin/admin-api';

export function AdminLoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await adminFetch<{ admin: AdminIdentity }>('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      router.replace(result.admin.mustChangePassword ? '/admin/seguranca' : '/admin');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof AdminApiError ? cause.message : 'Não foi possível entrar no painel.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      <label className="block text-sm font-semibold">
        E-mail
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="username" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" />
      </label>
      <label className="block text-sm font-semibold">
        Senha
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 font-normal" />
      </label>
      {error ? <p className="rounded-xl border border-red-900/70 bg-red-950/40 px-4 py-3 text-sm text-red-300">{error}</p> : null}
      <button disabled={loading} className="w-full rounded-xl bg-white px-4 py-3 font-bold text-slate-950 disabled:opacity-60">
        {loading ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  );
}
