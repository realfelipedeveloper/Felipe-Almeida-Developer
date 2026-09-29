import { AdminLoginForm } from '@/components/admin/admin-login-form';

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#09090a] px-5 py-16 text-zinc-100">
      <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[55rem] -translate-x-1/2 rounded-full bg-zinc-400/[0.07] blur-3xl" />

      <section className="site-panel relative w-full max-w-md p-8 md:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-800 bg-zinc-900 font-mono text-[10px] text-zinc-300">
            &lt;/&gt;
          </span>
          <div>
            <p className="eyebrow">Área restrita</p>
            <p className="mt-1 text-xs text-zinc-600">FELIPE.DEV / ADMIN</p>
          </div>
        </div>

        <h1 className="text-3xl font-bold tracking-[-0.04em]">Administração</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Entre com sua conta administrativa para gerenciar o conteúdo público do portfólio.
        </p>

        <AdminLoginForm />
      </section>
    </main>
  );
}
