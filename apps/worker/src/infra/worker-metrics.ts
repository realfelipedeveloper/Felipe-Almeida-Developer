export type WorkerCounter =
  | 'audit_processed'
  | 'audit_duplicate'
  | 'audit_failed'
  | 'notification_processed'
  | 'notification_duplicate'
  | 'notification_failed'
  | 'outbox_published'
  | 'outbox_failed'
  | 'scheduled_article_published'
  | 'scheduled_newsletter_issue_published'
  | 'publication_scheduler_failed'
  | 'retry_published'
  | 'dead_letter_published';

const metricNames: Record<WorkerCounter, string> = {
  audit_processed: 'fad_worker_audit_processed_total',
  audit_duplicate: 'fad_worker_audit_duplicate_total',
  audit_failed: 'fad_worker_audit_failed_total',
  notification_processed: 'fad_worker_notification_processed_total',
  notification_duplicate: 'fad_worker_notification_duplicate_total',
  notification_failed: 'fad_worker_notification_failed_total',
  outbox_published: 'fad_worker_outbox_published_total',
  outbox_failed: 'fad_worker_outbox_failed_total',
  scheduled_article_published: 'fad_worker_scheduled_article_published_total',
  scheduled_newsletter_issue_published: 'fad_worker_scheduled_newsletter_issue_published_total',
  publication_scheduler_failed: 'fad_worker_publication_scheduler_failed_total',
  retry_published: 'fad_worker_retry_published_total',
  dead_letter_published: 'fad_worker_dead_letter_published_total',
};

export class WorkerMetrics {
  private readonly startedAt = Date.now();
  private readonly counters = new Map<WorkerCounter, number>();

  increment(counter: WorkerCounter): void {
    this.counters.set(counter, (this.counters.get(counter) ?? 0) + 1);
  }

  toPrometheus(): string {
    const lines = [
      '# HELP fad_worker_uptime_seconds Tempo de atividade do processo worker.',
      '# TYPE fad_worker_uptime_seconds gauge',
      `fad_worker_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1_000)}`,
    ];
    for (const counter of Object.keys(metricNames) as WorkerCounter[]) {
      const name = metricNames[counter];
      lines.push(`# HELP ${name} Contador operacional do worker: ${counter}.`);
      lines.push(`# TYPE ${name} counter`);
      lines.push(`${name} ${this.counters.get(counter) ?? 0}`);
    }
    return `${lines.join('\n')}\n`;
  }
}

export const workerMetrics = new WorkerMetrics();
