import { AdminLoginForm } from '@/components/admin/admin-login-form';

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-16 text-slate-100">
      <section className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Área restrita</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Administração</h1>
        <p className="mt-3 text-sm leading-6 text-slate-400">Entre com sua conta administrativa para gerenciar o conteúdo público do portfólio.</p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
