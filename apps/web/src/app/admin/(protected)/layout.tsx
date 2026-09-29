import { AdminSessionGate } from '@/components/admin/admin-session-gate';
import { AdminShell } from '@/components/admin/admin-shell';

export default function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AdminSessionGate>
      <AdminShell>{children}</AdminShell>
    </AdminSessionGate>
  );
}
