import { AdminPasswordResetForm } from '@/components/admin/admin-password-reset-form';

export default async function AdminPasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
  }>;
}) {
  const { token = '' } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a11] px-5 py-16 text-zinc-100">
      <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[58rem] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      <AdminPasswordResetForm token={token} />
    </main>
  );
}
