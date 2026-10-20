import { AdminLoginForm } from '@/components/admin/admin-login-form';

export default function AdminLoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#070a11] px-5 py-16 text-zinc-100">
      <div className="absolute left-[12%] top-[-18rem] h-[42rem] w-[42rem] rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute bottom-[-22rem] right-[4%] h-[38rem] w-[38rem] rounded-full bg-violet-500/10 blur-3xl" />

      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c111c]/82 shadow-[0_40px_140px_rgba(0,0,0,.58)] backdrop-blur-2xl md:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/[0.07] p-12 md:flex md:flex-col md:justify-between">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full border border-indigo-300/10 bg-indigo-400/[0.05]" />
          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="brand-mark" aria-hidden="true">
                FA
              </span>
              <div>
                <p className="text-sm font-extrabold tracking-[-0.04em]">FELIPE.DEV</p>
                <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">
                  Content studio
                </p>
              </div>
            </div>
            <p className="eyebrow mt-16">Workspace privado</p>
            <h1 className="mt-6 text-5xl font-bold leading-[0.98] tracking-[-0.06em]">
              Conteúdo sob controle. Experiência em evolução.
            </h1>
          </div>
          <div className="relative grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-6 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
            <span>Seguro</span>
            <span>Auditável</span>
            <span>Multilíngue</span>
          </div>
        </section>

        <section className="p-7 sm:p-10 md:p-12">
          <div className="mb-9 flex items-center gap-3 md:hidden">
            <span className="brand-mark" aria-hidden="true">
              FA
            </span>
            <div>
              <p className="text-sm font-extrabold">FELIPE.DEV</p>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-600">Admin</p>
            </div>
          </div>

          <p className="eyebrow">Área restrita</p>
          <h2 className="mt-5 text-4xl font-bold tracking-[-0.055em]">Boas-vindas.</h2>
          <p className="mt-4 text-sm leading-7 text-zinc-400">
            Entre com sua conta administrativa para gerenciar o conteúdo público do portfólio.
          </p>

          <AdminLoginForm />
        </section>
      </div>
    </main>
  );
}
