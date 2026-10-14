import type { PrivacyRequestStatus, PrivacyRequestType, PublicLocale } from '../domain/privacy';

export const PRIVACY_REPOSITORY = Symbol('PRIVACY_REPOSITORY');
export const PRIVACY_RATE_LIMITER = Symbol('PRIVACY_RATE_LIMITER');
export const PRIVACY_AUDIT_LOGGER = Symbol('PRIVACY_AUDIT_LOGGER');

export interface PrivacyRequestRecord {
  id: string;
  email: string;
  type: PrivacyRequestType;
  status: PrivacyRequestStatus;
  locale: PublicLocale;
  verificationExpiresAt: Date | null;
}

export interface PrivacyExportData {
  email: string;
  contacts: unknown[];
  newsletter: unknown | null;
  consents: unknown[];
  privacyRequests: unknown[];
}

export interface PrivacyTransaction {
  getRequest(id: string): Promise<PrivacyRequestRecord | null>;
  exportSubject(email: string): Promise<PrivacyExportData>;
  completeExport(id: string, completedAt: Date): Promise<void>;
  markDeleteVerified(
    id: string,
    confirmationTokenHash: string,
    confirmationExpiresAt: Date,
    verifiedAt: Date,
  ): Promise<void>;
  expireRequest(id: string): Promise<void>;
  deleteSubject(input: { requestId: string; email: string; completedAt: Date }): Promise<void>;
}

export interface PrivacyRepository {
  createRequest(input: {
    id: string;
    email: string;
    type: PrivacyRequestType;
    locale: PublicLocale;
    verificationTokenHash: string;
    verificationExpiresAt: Date;
    correlationId: string;
    startedAt: Date;
  }): Promise<boolean>;
  withLockedRequest<T>(
    verificationTokenHash: string,
    execute: (requestId: string, transaction: PrivacyTransaction) => Promise<T>,
  ): Promise<T | null>;
  recordConsent(input: {
    subjectKey: string;
    granted: boolean;
    policyVersion: string;
    locale: PublicLocale;
    source: string;
    ipHash: string;
    subjectKind: 'ANONYMOUS_BROWSER' | 'EMAIL';
  }): Promise<void>;
}

export interface PrivacyRateLimiter {
  increment(key: string, ttlSeconds: number): Promise<number>;
}

export interface PrivacyAuditLogger {
  info(message: string): void;
  warn(error: unknown, message: string): void;
}
