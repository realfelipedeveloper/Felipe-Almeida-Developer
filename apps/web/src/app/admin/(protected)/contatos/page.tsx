import { AdminEngagementList } from '@/components/admin/admin-engagement-list';

export default function AdminContactsPage() {
  return (
    <section>
      <p className="eyebrow">ENGAGEMENT / INBOX</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em]">Contatos</h1>
      <p className="mt-3 mb-8 text-sm text-zinc-400">
        Mensagens recebidas pelo formulário público do portfólio.
      </p>
      <AdminEngagementList kind="contacts" />
    </section>
  );
}
