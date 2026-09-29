'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { adminFetch, type AdminIdentity } from '@/lib/admin/admin-api';

export function AdminSessionGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    adminFetch<{ admin: AdminIdentity }>('/api/admin/auth/me')
      .then(({ admin }) => {
        if (!active) return;
        if (admin.mustChangePassword && pathname !== '/admin/seguranca') {
          router.replace('/admin/seguranca');
          return;
        }
        setReady(true);
      })
      .catch(() => router.replace('/admin/login'));
    return () => { active = false; };
  }, [pathname, router]);

  if (!ready) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">Validando sessão…</div>;
  }
  return <>{children}</>;
}
