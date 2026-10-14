export function toDateTimeLocal(
  value: string | Date,
  timezoneOffsetMinutes?: number,
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = timezoneOffsetMinutes ?? date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function localDateTimeToIso(
  value: string,
  timezoneOffsetMinutes?: number,
): string | null {
  if (!value) return null;
  if (timezoneOffsetMinutes === undefined) return new Date(value).toISOString();
  const localAsUtc = new Date(`${value}:00.000Z`);
  return new Date(localAsUtc.getTime() + timezoneOffsetMinutes * 60_000).toISOString();
}

export function currentDateTimeLocal(now = new Date()): string {
  return toDateTimeLocal(now);
}
