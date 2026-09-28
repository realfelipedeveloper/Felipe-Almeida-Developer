import type { Metadata } from 'next';
import { locales, type Locale } from '@/i18n/config';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const SITE_NAME = 'Felipe Almeida Developer';

export function absoluteUrl(path = '/') {
  return new URL(path, siteUrl).toString();
}

export function localizedPath(locale: Locale, path = '') {
  const suffix = path ? `/${path.replace(/^\/+/, '')}` : '';
  return `/${locale}${suffix}`;
}

export function languageAlternates(path = '') {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, absoluteUrl(localizedPath(locale, path))]),
  );
  return {
    ...languages,
    'x-default': absoluteUrl(localizedPath('pt-BR', path)),
  };
}

export function pageMetadata(input: {
  locale: Locale;
  title: string;
  description: string;
  path?: string;
  image?: string;
  languagePaths?: Partial<Record<Locale, string>>;
}): Metadata {
  const path = input.path ?? '';
  const canonical = absoluteUrl(localizedPath(input.locale, path));
  const languages = input.languagePaths
    ? {
        ...Object.fromEntries(
          Object.entries(input.languagePaths).map(([locale, localePath]) => [
            locale,
            absoluteUrl(localizedPath(locale as Locale, localePath)),
          ]),
        ),
        'x-default': absoluteUrl(
          localizedPath('pt-BR', input.languagePaths['pt-BR'] ?? path),
        ),
      }
    : languageAlternates(path);

  const image = absoluteUrl(input.image ?? '/images/Eu.png');

  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      languages,
      types: {
        'application/rss+xml': absoluteUrl(`/${input.locale}/rss.xml`),
      },
    },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url: canonical,
      images: [{ url: image, alt: SITE_NAME }],
      locale: input.locale === 'pt-BR' ? 'pt_BR' : input.locale === 'en' ? 'en_US' : 'es_ES',
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [image],
    },
  };
}
