import type { SupportedLocale } from '../../../shared/domain/locale';

export interface ProfileTranslation {
  locale: SupportedLocale;
  fullName: string;
  headline: string;
  summary: string;
  bio: string;
}

export interface Profile {
  id: string;
  publicEmail: string | null;
  publicLocation: string | null;
  availableForWork: boolean;
  avatarMediaId: string | null;
  resumeMediaId: string | null;
  translations: ProfileTranslation[];
}
