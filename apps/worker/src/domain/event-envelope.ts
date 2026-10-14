export interface EventEnvelope {
  eventId: string;
  eventName: string;
  occurredAt: string;
  correlationId: string;
  version: number;
  payload: Record<string, unknown>;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_NAME_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

export function parseEventEnvelope(content: Buffer): EventEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(content.toString('utf8'));
  } catch {
    throw new Error('INVALID_EVENT_ENVELOPE');
  }

  if (!isRecord(value)) throw new Error('INVALID_EVENT_ENVELOPE');
  const { eventId, eventName, occurredAt, correlationId, version, payload } = value;
  if (
    typeof eventId !== 'string' ||
    !UUID_PATTERN.test(eventId) ||
    typeof eventName !== 'string' ||
    eventName.length > 160 ||
    !EVENT_NAME_PATTERN.test(eventName) ||
    typeof occurredAt !== 'string' ||
    !isIsoDate(occurredAt) ||
    typeof correlationId !== 'string' ||
    !UUID_PATTERN.test(correlationId) ||
    !Number.isInteger(version) ||
    Number(version) < 1 ||
    !isRecord(payload)
  ) {
    throw new Error('INVALID_EVENT_ENVELOPE');
  }

  return {
    eventId,
    eventName,
    occurredAt,
    correlationId,
    version: Number(version),
    payload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}
