import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import type { PrivacyRequestType, PublicLocale } from '../domain/privacy';
import {
  PRIVACY_AUDIT_LOGGER,
  PRIVACY_RATE_LIMITER,
  PRIVACY_REPOSITORY,
  type PrivacyAuditLogger,
  type PrivacyRateLimiter,
  type PrivacyRepository,
} from './privacy.ports';

export interface PrivacyRequestInput {
  email: string;
  type: PrivacyRequestType;
  locale: PublicLocale;
  website?: string;
}

export interface PrivacyConsentInput {
  subjectId: string;
  granted: boolean;
  policyVersion: string;
  locale: PublicLocale;
}

const copy = {
  'pt-BR': {
    requested: 'Se o endereço for válido, enviaremos um link de verificação.',
    invalid: 'O link de privacidade é inválido ou expirou.',
    deleted: 'Os dados associados ao endereço verificado foram anonimizados ou excluídos.',
    rateLimit: 'Muitas solicitações. Aguarde antes de tentar novamente.',
  },
  en: {
    requested: 'If the address is valid, we will send a verification link.',
    invalid: 'The privacy link is invalid or expired.',
    deleted: 'Data associated with the verified address was anonymized or deleted.',
    rateLimit: 'Too many requests. Wait before trying again.',
  },
  es: {
    requested: 'Si la dirección es válida, enviaremos un enlace de verificación.',
    invalid: 'El enlace de privacidad no es válido o ha caducado.',
    deleted: 'Los datos asociados a la dirección verificada fueron anonimizados o eliminados.',
    rateLimit: 'Demasiadas solicitudes. Espera antes de volver a intentarlo.',
  },
} satisfies Record<PublicLocale, Record<string, string>>;

@Injectable()
export class PrivacyService {
  constructor(
    @Inject(PRIVACY_REPOSITORY) private readonly repository: PrivacyRepository,
    @Inject(PRIVACY_RATE_LIMITER) private readonly rateLimiter: PrivacyRateLimiter,
    @Inject(PRIVACY_AUDIT_LOGGER) private readonly logger: PrivacyAuditLogger,
  ) {}

  async request(input: PrivacyRequestInput, ip: string | undefined, correlationId?: string) {
    const startedAt = new Date();
    const locale = input.locale;
    if (input.website?.trim()) {
      this.logger.info('Honeypot acionado em solicitação de privacidade');
      return { message: copy[locale].requested };
    }

    const email = input.email.trim().toLowerCase();
    await this.enforceRateLimit(`ip:${this.hashIp(ip)}`, 5, 60 * 60, locale);
    const emailAllowed = await this.enforceRateLimit(
      `email:${this.hashSubject(`privacy-rate-email:${email}`)}`,
      3,
      24 * 60 * 60,
      locale,
      true,
    );
    if (!emailAllowed) return { message: copy[locale].requested };

    const id = randomUUID();
    const token = this.verificationToken(id, input.type);
    await this.repository.createRequest({
      id,
      email,
      type: input.type,
      locale,
      verificationTokenHash: this.hashValue(token),
      verificationExpiresAt: new Date(Date.now() + 30 * 60 * 1_000),
      correlationId: this.safeUuid(correlationId) ?? randomUUID(),
      startedAt,
    });
    return { message: copy[locale].requested };
  }

  async verify(token: string, ip?: string) {
    await Promise.all([
      this.enforceRateLimit(`verify-ip:${this.hashIp(ip)}`, 20, 60 * 60, 'pt-BR'),
      this.enforceRateLimit(`verify-token:${this.hashValue(token)}`, 5, 60 * 60, 'pt-BR'),
    ]);

    const result = await this.repository.withLockedRequest(
      this.hashValue(token),
      async (requestId, transaction) => {
        const request = await transaction.getRequest(requestId);
        const locale = request?.locale ?? 'pt-BR';
        if (!request || !request.verificationExpiresAt) {
          return { kind: 'invalid' as const, locale };
        }
        if (request.verificationExpiresAt.getTime() < Date.now()) {
          await transaction.expireRequest(request.id);
          return { kind: 'invalid' as const, locale };
        }

        const completedAt = new Date();
        if (request.type === 'EXPORT') {
          if (request.status !== 'PENDING') return { kind: 'invalid' as const, locale };
          const data = await transaction.exportSubject(request.email);
          await transaction.completeExport(request.id, completedAt);
          return { kind: 'success' as const, type: 'EXPORT' as const, data };
        }

        if (request.status === 'PENDING') {
          const confirmationToken = this.deleteConfirmationToken(request.id);
          await transaction.markDeleteVerified(
            request.id,
            this.hashValue(confirmationToken),
            new Date(Date.now() + 10 * 60 * 1_000),
            completedAt,
          );
          return {
            kind: 'success' as const,
            type: 'DELETE' as const,
            confirmationRequired: true as const,
            confirmationToken,
          };
        }
        if (request.status !== 'VERIFIED') return { kind: 'invalid' as const, locale };

        await transaction.deleteSubject({
          requestId: request.id,
          email: request.email,
          completedAt,
        });
        return {
          kind: 'success' as const,
          type: 'DELETE' as const,
          confirmationRequired: false as const,
          message: copy[locale].deleted,
        };
      },
    );

    if (!result) throw new BadRequestException(copy['pt-BR'].invalid);
    if (result.kind === 'invalid') throw new BadRequestException(copy[result.locale].invalid);
    const { kind: _kind, ...response } = result;
    return response;
  }

  async recordConsent(input: PrivacyConsentInput, ip: string | undefined): Promise<void> {
    await this.enforceRateLimit(`consent:${this.hashIp(ip)}`, 60, 60 * 60, input.locale);
    await this.repository.recordConsent({
      subjectKey: this.hashSubject(input.subjectId),
      granted: input.granted,
      policyVersion: input.policyVersion,
      locale: input.locale,
      source: 'web-cookie-preferences',
      ipHash: this.hashIp(ip),
      subjectKind: 'ANONYMOUS_BROWSER',
    });
  }

  private async enforceRateLimit(
    identity: string,
    limit: number,
    ttlSeconds: number,
    locale: PublicLocale,
    silentExcess = false,
  ): Promise<boolean> {
    try {
      const count = await this.rateLimiter.increment(`rate:privacy:${identity}`, ttlSeconds);
      if (count > limit) {
        if (silentExcess) return false;
        throw new HttpException(copy[locale].rateLimit, HttpStatus.TOO_MANY_REQUESTS);
      }
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (process.env.NODE_ENV === 'production') {
        throw new ServiceUnavailableException(
          'Proteção contra abuso temporariamente indisponível.',
        );
      }
      this.logger.warn(
        error,
        'Rate limit de privacidade indisponível; solicitação seguirá em modo degradado local',
      );
      return true;
    }
  }

  private verificationToken(requestId: string, type: PrivacyRequestType): string {
    const signature = createHmac('sha256', this.tokenSecret())
      .update(`privacy-request:${requestId}:${type}`)
      .digest('base64url');
    return `${requestId}.${signature}`;
  }

  private deleteConfirmationToken(requestId: string): string {
    const signature = createHmac('sha256', this.tokenSecret())
      .update(`privacy-delete-confirmation:${requestId}`)
      .digest('base64url');
    return `${requestId}.${signature}`;
  }

  private tokenSecret(): string {
    const secret = process.env.PRIVACY_REQUEST_TOKEN_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_REQUEST_TOKEN_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return secret;
  }

  private hashIp(ip: string | undefined): string {
    return createHmac('sha256', this.hashSecret())
      .update(ip ?? 'desconhecido')
      .digest('hex');
  }

  private hashSubject(subjectId: string): string {
    return createHmac('sha256', this.hashSecret()).update(subjectId).digest('hex');
  }

  private hashSecret(): string {
    const secret = process.env.PRIVACY_HASH_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_HASH_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return secret;
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeUuid(value: string | undefined): string | null {
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }
}
