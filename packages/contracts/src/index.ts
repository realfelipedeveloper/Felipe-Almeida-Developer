export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
}

export const SUPPORTED_LOCALES = ['pt-BR', 'en', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DOMAIN_EVENT_NAMES = [
  'contact.submitted',
  'newsletter.subscribed',
  'newsletter.issue.published',
  'article.published',
] as const;

export type DomainEventName = (typeof DOMAIN_EVENT_NAMES)[number];

export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventName: DomainEventName | string;
  occurredAt: string;
  correlationId: string;
  version: number;
  payload: TPayload;
}
