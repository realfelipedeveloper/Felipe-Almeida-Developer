export const PUBLICATION_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
