import { AdminEngagementList } from '@/components/admin/admin-engagement-list';
import { AdminNewsletterIssues } from '@/components/admin/admin-newsletter-issues';

export default function AdminNewsletterPage() {
  return (
    <section>
      <p className="eyebrow">ENGAGEMENT / NEWSLETTER</p>
      <h1 className="mt-3 text-4xl font-bold tracking-[-0.045em]">Newsletter</h1>
      <p className="mt-3 mb-8 text-sm text-zinc-400">
        Inscritos, confirmações e cancelamentos da newsletter.
      </p>
      <AdminNewsletterIssues />
      <div className="border-t border-zinc-800 pt-10">
        <h2 className="mb-5 text-2xl font-bold">Inscritos</h2>
        <AdminEngagementList kind="newsletter" />
      </div>
    </section>
  );
}
