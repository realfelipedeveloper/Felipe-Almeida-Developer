import { Locale as PrismaLocale } from '@prisma/client';
import type { SupportedLocale } from './locale';

const TO_PRISMA: Record<SupportedLocale, PrismaLocale> = {
  'pt-BR': PrismaLocale.PT_BR,
  en: PrismaLocale.EN,
  es: PrismaLocale.ES,
};

const FROM_PRISMA: Record<PrismaLocale, SupportedLocale> = {
  [PrismaLocale.PT_BR]: 'pt-BR',
  [PrismaLocale.EN]: 'en',
  [PrismaLocale.ES]: 'es',
};

export function toPrismaLocale(locale: SupportedLocale): PrismaLocale {
  return TO_PRISMA[locale];
}

export function fromPrismaLocale(locale: PrismaLocale): SupportedLocale {
  return FROM_PRISMA[locale];
}
