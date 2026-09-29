import { AdminPasswordResetForm } from '@/components/admin/admin-password-reset-form';

export default async function AdminPasswordResetPage({
  searchParams,
}: {
  searchParams: Promise<{
    token?: string;
  }>;
}) {
  const { token = '' } =
    await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090a] px-5 py-16 text-zinc-100">
      <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[55rem] -translate-x-1/2 rounded-full bg-zinc-400/[0.07] blur-3xl" />

      <AdminPasswordResetForm
        token={token}
      />
    </main>
  );
}
