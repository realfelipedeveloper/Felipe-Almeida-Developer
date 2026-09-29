import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import {
  NewsletterSubscriberStatus,
  NewsletterTokenPurpose,
  Prisma,
} from '@prisma/client';
import {
  createHash,
  createHmac,
  randomUUID,
} from 'node:crypto';
import { AppLogger } from '../../../infra/logging/app-logger.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import { toPrismaLocale } from '../../../shared/domain/locale.mapper';
import type {
  ContactMessageDto,
  NewsletterSubscribeDto,
} from '../presentation/dto/engagement.dto';

type PublicLocale = 'pt-BR' | 'en' | 'es';

const messages = {
  'pt-BR': {
    contact: 'Mensagem recebida. Retornarei assim que possível.',
    subscribe: 'Confira seu e-mail para confirmar a inscrição.',
    alreadyActive: 'Este e-mail já está inscrito na newsletter.',
    confirmed: 'Inscrição confirmada com sucesso.',
    unsubscribed: 'Inscrição cancelada com sucesso.',
    invalidToken: 'O link é inválido ou expirou.',
    rateLimit: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  },
  en: {
    contact: 'Message received. I will get back to you as soon as possible.',
    subscribe: 'Check your email to confirm your subscription.',
    alreadyActive: 'This email is already subscribed to the newsletter.',
    confirmed: 'Subscription confirmed successfully.',
    unsubscribed: 'Subscription cancelled successfully.',
    invalidToken: 'This link is invalid or has expired.',
    rateLimit: 'Too many attempts. Please wait a few minutes and try again.',
  },
  es: {
    contact: 'Mensaje recibido. Responderé lo antes posible.',
    subscribe: 'Revisa tu correo para confirmar la suscripción.',
    alreadyActive: 'Este correo ya está suscrito a la newsletter.',
    confirmed: 'Suscripción confirmada correctamente.',
    unsubscribed: 'Suscripción cancelada correctamente.',
    invalidToken: 'El enlace no es válido o ha caducado.',
    rateLimit: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  },
} satisfies Record<PublicLocale, Record<string, string>>;

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly logger: AppLogger,
  ) {}

  async submitContact(body: ContactMessageDto, ip: string | undefined, correlationId?: string) {
    const locale = body.locale as PublicLocale;

    if (body.website?.trim()) {
      this.logger.child('seguranca').info('Honeypot acionado no formulário de contato');
      return { message: messages[locale].contact };
    }

    const email = body.email.trim().toLowerCase();
    const ipHash = this.hashIp(ip);

    await Promise.all([
      this.enforceRateLimit(`contact:ip:${ipHash}`, 5, 60 * 60, locale),
      this.enforceRateLimit(`contact:email:${this.hashValue(email)}`, 8, 24 * 60 * 60, locale),
    ]);

    const messageId = randomUUID();
    const eventId = randomUUID();
    const eventCorrelationId = this.safeUuid(correlationId) ?? randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.contactMessage.create({
        data: {
          id: messageId,
          name: body.name.trim(),
          email,
          subject: body.subject.trim(),
          message: body.message.trim(),
          locale: toPrismaLocale(locale),
          ipHash,
          correlationId: eventCorrelationId,
        },
      });

      await tx.outboxEvent.create({
        data: {
          id: eventId,
          eventName: 'contact.created',
          aggregateType: 'ContactMessage',
          aggregateId: messageId,
          correlationId: eventCorrelationId,
          payload: {
            contactMessageId: messageId,
            name: body.name.trim(),
            email,
            subject: body.subject.trim(),
            message: body.message.trim(),
            locale,
          } satisfies Prisma.JsonObject,
        },
      });
    });

    return { message: messages[locale].contact };
  }

  async subscribe(body: NewsletterSubscribeDto, ip: string | undefined, correlationId?: string) {
    const locale = body.locale as PublicLocale;

    if (body.website?.trim()) {
      this.logger.child('seguranca').info('Honeypot acionado na newsletter');
      return { message: messages[locale].subscribe };
    }

    const email = body.email.trim().toLowerCase();
    const ipHash = this.hashIp(ip);

    await Promise.all([
      this.enforceRateLimit(`newsletter:ip:${ipHash}`, 5, 60 * 60, locale),
      this.enforceRateLimit(`newsletter:email:${this.hashValue(email)}`, 5, 24 * 60 * 60, locale),
    ]);

    const current = await this.prisma.newsletterSubscriber.findUnique({ where: { email } });
    if (current?.status === NewsletterSubscriberStatus.ACTIVE) {
      return { message: messages[locale].alreadyActive };
    }

    const subscriberId = current?.id ?? randomUUID();
    const tokenId = randomUUID();
    const token = this.deriveNewsletterToken(
      tokenId,
      subscriberId,
      NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
    );
    const tokenHash = this.hashValue(token);
    const correlation = this.safeUuid(correlationId) ?? randomUUID();

    await this.prisma.$transaction(async (tx) => {
      if (current) {
        await tx.newsletterSubscriber.update({
          where: { id: current.id },
          data: {
            locale: toPrismaLocale(locale),
            status: NewsletterSubscriberStatus.PENDING,
            consentSource: 'formulario-publico',
            consentIpHash: ipHash,
            confirmedAt: null,
            unsubscribedAt: null,
            bounceReason: null,
          },
        });
      } else {
        await tx.newsletterSubscriber.create({
          data: {
            id: subscriberId,
            email,
            locale: toPrismaLocale(locale),
            status: NewsletterSubscriberStatus.PENDING,
            consentSource: 'formulario-publico',
            consentIpHash: ipHash,
          },
        });
      }

      await tx.newsletterToken.deleteMany({
        where: {
          subscriberId,
          purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
          usedAt: null,
        },
      });

      await tx.newsletterToken.create({
        data: {
          id: tokenId,
          subscriberId,
          purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
          tokenHash,
          expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1_000),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventName: 'newsletter.confirmation.requested',
          aggregateType: 'NewsletterSubscriber',
          aggregateId: subscriberId,
          correlationId: correlation,
          payload: {
            subscriberId,
            tokenId,
            purpose: NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
            email,
            locale,
          } satisfies Prisma.JsonObject,
        },
      });
    });

    return { message: messages[locale].subscribe };
  }

  async confirm(token: string) {
    const tokenHash = this.hashValue(token);
    const row = await this.prisma.newsletterToken.findUnique({
      where: { tokenHash },
      include: { subscriber: true },
    });
    const locale = this.fromPrismaLocale(row?.subscriber.locale) ?? 'pt-BR';

    if (
      !row ||
      row.purpose !== NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(messages[locale].invalidToken);
    }

    if (row.usedAt && row.subscriber.status === NewsletterSubscriberStatus.ACTIVE) {
      return { message: messages[locale].confirmed };
    }

    const unsubscribeTokenId = randomUUID();
    const unsubscribeToken = this.deriveNewsletterToken(
      unsubscribeTokenId,
      row.subscriberId,
      NewsletterTokenPurpose.UNSUBSCRIBE,
    );
    const correlationId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      await tx.newsletterToken.update({
        where: { id: row.id },
        data: { usedAt: row.usedAt ?? new Date() },
      });

      await tx.newsletterSubscriber.update({
        where: { id: row.subscriberId },
        data: {
          status: NewsletterSubscriberStatus.ACTIVE,
          confirmedAt: row.subscriber.confirmedAt ?? new Date(),
          unsubscribedAt: null,
          bounceReason: null,
        },
      });

      await tx.newsletterToken.deleteMany({
        where: {
          subscriberId: row.subscriberId,
          purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
          usedAt: null,
        },
      });

      await tx.newsletterToken.create({
        data: {
          id: unsubscribeTokenId,
          subscriberId: row.subscriberId,
          purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
          tokenHash: this.hashValue(unsubscribeToken),
          expiresAt: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1_000),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventName: 'newsletter.confirmed',
          aggregateType: 'NewsletterSubscriber',
          aggregateId: row.subscriberId,
          correlationId,
          payload: {
            subscriberId: row.subscriberId,
            unsubscribeTokenId,
            purpose: NewsletterTokenPurpose.UNSUBSCRIBE,
            email: row.subscriber.email,
            locale,
          } satisfies Prisma.JsonObject,
        },
      });
    });

    return { message: messages[locale].confirmed };
  }

  async unsubscribe(token: string) {
    const tokenHash = this.hashValue(token);
    const row = await this.prisma.newsletterToken.findUnique({
      where: { tokenHash },
      include: { subscriber: true },
    });
    const locale = this.fromPrismaLocale(row?.subscriber.locale) ?? 'pt-BR';

    if (
      !row ||
      row.purpose !== NewsletterTokenPurpose.UNSUBSCRIBE ||
      row.expiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(messages[locale].invalidToken);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.newsletterToken.update({
        where: { id: row.id },
        data: { usedAt: row.usedAt ?? new Date() },
      });

      await tx.newsletterSubscriber.update({
        where: { id: row.subscriberId },
        data: {
          status: NewsletterSubscriberStatus.UNSUBSCRIBED,
          unsubscribedAt: new Date(),
        },
      });

      await tx.outboxEvent.create({
        data: {
          eventName: 'newsletter.unsubscribed',
          aggregateType: 'NewsletterSubscriber',
          aggregateId: row.subscriberId,
          payload: {
            subscriberId: row.subscriberId,
            email: row.subscriber.email,
            locale,
          } satisfies Prisma.JsonObject,
        },
      });
    });

    return { message: messages[locale].unsubscribed };
  }

  private async enforceRateLimit(
    key: string,
    limit: number,
    ttlSeconds: number,
    locale: PublicLocale,
  ): Promise<void> {
    try {
      const count = await this.redis.connection.incr(`rate:engagement:${key}`);
      if (count === 1) {
        await this.redis.connection.expire(`rate:engagement:${key}`, ttlSeconds);
      }
      if (count > limit) {
        throw new HttpException(messages[locale].rateLimit, HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.child('seguranca', { chaveRateLimit: key }).warn(
        { erro: error instanceof Error ? error.message : String(error) },
        'Redis indisponível durante rate limit público; requisição seguirá com validações restantes',
      );
    }
  }

  private deriveNewsletterToken(
    tokenId: string,
    subscriberId: string,
    purpose: NewsletterTokenPurpose,
  ): string {
    const signature = createHmac('sha256', this.tokenSecret())
      .update(`${tokenId}:${subscriberId}:${purpose}`)
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private tokenSecret(): string {
    const configured = process.env.NEWSLETTER_TOKEN_SECRET?.trim();
    if (configured && !configured.startsWith('gere-')) return configured;

    const fallback = process.env.JWT_REFRESH_SECRET?.trim();
    if (!fallback || fallback.length < 32 || fallback.startsWith('gere-')) {
      throw new Error('NEWSLETTER_TOKEN_SECRET ou JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return fallback;
  }

  private hashIp(ip: string | undefined): string {
    const secret =
      process.env.PRIVACY_HASH_SECRET?.trim() ||
      process.env.JWT_REFRESH_SECRET?.trim() ||
      'desenvolvimento-local';

    return createHmac('sha256', secret).update(ip ?? 'desconhecido').digest('hex');
  }

  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private safeUuid(value: string | undefined): string | null {
    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
      ? value
      : null;
  }

  private fromPrismaLocale(locale: unknown): PublicLocale | null {
    if (locale === 'PT_BR') return 'pt-BR';
    if (locale === 'EN') return 'en';
    if (locale === 'ES') return 'es';
    return null;
  }
}
