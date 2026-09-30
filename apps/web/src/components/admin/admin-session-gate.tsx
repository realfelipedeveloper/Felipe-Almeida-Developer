'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { adminFetch, type AdminIdentity } from '@/lib/admin/admin-api';
import { shouldRedirectToAdminLogin } from '@/lib/admin/admin-session';

export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;

    setReady(false);
    setValidationError(null);

    adminFetch<{ admin: AdminIdentity }>('/api/admin/auth/me')
      .then(({ admin }) => {
        if (!active) return;

        if (admin.mustChangePassword && pathname !== '/admin/seguranca') {
          router.replace('/admin/seguranca');
          return;
        }

        setReady(true);
      })
      .catch((cause: unknown) => {
        if (!active) return;

        if (shouldRedirectToAdminLogin(cause)) {
          router.replace('/admin/login');
          return;
        }

        setValidationError(
          'Não foi possível validar sua sessão neste momento. Tente novamente em instantes.',
        );
      });

    return () => {
      active = false;
    };
  }, [pathname, router, validationAttempt]);

  if (validationError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <p className="text-sm text-slate-300">{validationError}</p>

          <button
            type="button"
            onClick={() => setValidationAttempt((current) => current + 1)}
            className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-bold text-slate-950"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Validando sessão…
      </div>
    );
  }

  return <>{children}</>;
}
