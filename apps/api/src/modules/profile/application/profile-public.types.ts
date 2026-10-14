export interface PublicProfile {
  id: string;
  fullName: string;
  headline: string;
  summary: string;
  bio: string;
  aboutEyebrow: string;
  aboutTitle: string;
  aboutIntro: string;
  aboutPrinciplesTitle: string;
  aboutGalleryTitle: string;
  aboutGalleryText: string;
  aboutResumeLabel: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publicEmail: string | null;
  publicLocation: string | null;
  availableForWork: boolean;
  avatarMediaId: string | null;
  resumeMediaId: string | null;
  principles: Array<{
    id: string;
    title: string;
    text: string;
    sortOrder: number;
  }>;
  gallery: Array<{
    mediaId: string;
    altText: string | null;
    sortOrder: number;
  }>;
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
