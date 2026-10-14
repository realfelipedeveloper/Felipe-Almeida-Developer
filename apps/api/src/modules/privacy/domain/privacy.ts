export const PUBLIC_LOCALES = ['pt-BR', 'en', 'es'] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];

export const PRIVACY_REQUEST_TYPES = ['EXPORT', 'DELETE'] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export type PrivacyRequestStatus =
  'PENDING' | 'VERIFIED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'EXPIRED';
