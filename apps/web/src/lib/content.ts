import { convert } from 'html-to-text';
import type { Locale } from '@/i18n/config';

const localeMap: Record<Locale, string> = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

export function cleanSeedText(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;

  return value.trim().toUpperCase().startsWith('TODO') ? fallback : value;
}

export function formatDate(value: string | null, locale: Locale) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(localeMap[locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function htmlToPlainText(html: string) {
  if (!html) {
    return '';
  }

  return convert(html, {
    wordwrap: false,
    selectors: [
      {
        selector: 'script',
        format: 'skip',
      },
      {
        selector: 'style',
        format: 'skip',
      },
    ],
  }).trim();
}

export function safeExternalUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);

    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
