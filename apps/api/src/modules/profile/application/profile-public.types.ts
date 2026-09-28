export interface PublicProfile {
  id: string;
  fullName: string;
  headline: string;
  summary: string;
  bio: string;
  publicEmail: string | null;
  publicLocation: string | null;
  availableForWork: boolean;
  avatarMediaId: string | null;
  resumeMediaId: string | null;
  socialLinks: Array<{
    label: string;
    url: string;
    iconKey: string | null;
    sortOrder: number;
  }>;
}

export interface ProfilePublicReadRepository {
  findPublic(locale: 'pt-BR' | 'en' | 'es'): Promise<PublicProfile | null>;
}

export const PROFILE_PUBLIC_READ_REPOSITORY = Symbol('PROFILE_PUBLIC_READ_REPOSITORY');
