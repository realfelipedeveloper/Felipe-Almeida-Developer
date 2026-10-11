import { NewsletterTokenPurpose, Prisma, PrismaClient, PrivacyRequestStatus } from '@prisma/client';
import { createHmac } from 'node:crypto';
import type { ConsumeMessage } from 'amqplib';
import { parseEventEnvelope } from '../domain/event-envelope.js';
import { RabbitConnection } from '../infra/rabbitmq.js';
import { logger } from '../infra/logger.js';
import { workerMetrics, type WorkerMetrics } from '../infra/worker-metrics.js';
import { EmailSender } from './email-sender.js';
import { WhatsAppSender } from './whatsapp-sender.js';

const CONSUMER_NAME = 'worker.notifications.v1';
const MAX_RETRIES = 5;
const SUBJECT_LOCK_TRANSACTION_TIMEOUT_MS = 30_000;

type PublicLocale = 'pt-BR' | 'en' | 'es';

const copy = {
  'pt-BR': {
    confirmSubject: 'Confirme sua inscrição na newsletter',
    confirmTitle: 'Falta só confirmar.',
    confirmText: 'Clique no botão abaixo para confirmar que deseja receber a newsletter.',
    confirmButton: 'Confirmar inscrição',
    welcomeSubject: 'Inscrição confirmada',
    welcomeTitle: 'Tudo certo.',
    welcomeText:
      'Sua inscrição foi confirmada. Você pode cancelar a qualquer momento pelo link abaixo.',
    unsubscribe: 'Cancelar inscrição',
    contactSubject: 'Novo contato pelo portfólio',
  },
  en: {
    confirmSubject: 'Confirm your newsletter subscription',
    confirmTitle: 'One last step.',
    confirmText: 'Use the button below to confirm that you want to receive the newsletter.',
    confirmButton: 'Confirm subscription',
    welcomeSubject: 'Subscription confirmed',
    welcomeTitle: 'You are all set.',
    welcomeText:
      'Your subscription is confirmed. You can unsubscribe at any time using the link below.',
    unsubscribe: 'Unsubscribe',
    contactSubject: 'New portfolio contact',
  },
  es: {
    confirmSubject: 'Confirma tu suscripción a la newsletter',
    confirmTitle: 'Solo falta confirmar.',
    confirmText: 'Usa el botón para confirmar que deseas recibir la newsletter.',
    confirmButton: 'Confirmar suscripción',
    welcomeSubject: 'Suscripción confirmada',
    welcomeTitle: 'Todo listo.',
    welcomeText:
      'Tu suscripción está confirmada. Puedes cancelarla cuando quieras desde el enlace inferior.',
    unsubscribe: 'Cancelar suscripción',
    contactSubject: 'Nuevo contacto desde el portafolio',
  },
} satisfies Record<PublicLocale, Record<string, string>>;

const passwordResetCopy = {
  subject: 'Recuperação de senha administrativa',
  title: 'Redefina sua senha.',
  text: 'Recebemos uma solicitação para redefinir a senha do painel administrativo. O link abaixo é válido por 30 minutos e pode ser usado apenas uma vez. Se você não solicitou esta alteração, ignore esta mensagem.',
  button: 'Redefinir senha',
};

const privacyCopy = {
  'pt-BR': {
    subject: 'Confirme sua solicitação de privacidade',
    title: 'Confirme sua identidade.',
    text: 'Use o link abaixo em até 30 minutos para concluir a exportação ou exclusão solicitada.',
    button: 'Verificar solicitação',
  },
  en: {
    subject: 'Confirm your privacy request',
    title: 'Confirm your identity.',
    text: 'Use the link below within 30 minutes to complete the requested export or deletion.',
    button: 'Verify request',
  },
  es: {
    subject: 'Confirma tu solicitud de privacidad',
    title: 'Confirma tu identidad.',
    text: 'Usa el enlace en un plazo de 30 minutos para completar la exportación o eliminación solicitada.',
    button: 'Verificar solicitud',
  },
} satisfies Record<PublicLocale, Record<string, string>>;

export class NotificationConsumer {
  private readonly email = new EmailSender();
  private readonly whatsapp = new WhatsAppSender();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbit: RabbitConnection,
    private readonly metrics: WorkerMetrics = workerMetrics,
  ) {}

  async start(): Promise<void> {
    await this.rabbit.consumeNotifications((message) => this.handle(message));
  }

  private async handle(message: ConsumeMessage): Promise<void> {
    try {
      const event = parseEventEnvelope(message.content);
      const processed = await this.prisma.$transaction(
        async (tx) => {
          await tx.$queryRaw(Prisma.sql`
            SELECT 1 AS acquired
            FROM pg_advisory_xact_lock(hashtextextended(${event.eventId}, 1))
          `);
          const existing = await tx.processedEvent.findUnique({
            where: {
              eventId_consumer: {
                eventId: event.eventId,
                consumer: CONSUMER_NAME,
              },
            },
          });
          if (existing) return false;

          if (event.eventName === 'contact.submitted' || event.eventName === 'contact.created') {
            await this.handleContact(tx, event.payload);
          } else if (
            event.eventName === 'newsletter.subscribed' ||
            event.eventName === 'newsletter.confirmation.requested'
          ) {
            await this.handleConfirmation(tx, event.payload);
          } else if (event.eventName === 'newsletter.confirmed') {
            await this.handleWelcome(tx, event.payload);
          } else if (event.eventName === 'admin.password-reset.requested') {
            await this.handlePasswordReset(event.payload);
          } else if (event.eventName === 'privacy.verification.requested') {
            await this.handlePrivacyVerificationInTransaction(tx, event.payload);
          }

          await tx.processedEvent.create({
            data: {
              eventId: event.eventId,
              consumer: CONSUMER_NAME,
            },
          });
          return true;
        },
        { maxWait: 5_000, timeout: SUBJECT_LOCK_TRANSACTION_TIMEOUT_MS },
      );
      this.metrics.increment(processed ? 'notification_processed' : 'notification_duplicate');

      this.rabbit.ack(message);
    } catch (error) {
      this.metrics.increment('notification_failed');
      const currentRetry = Number(message.properties.headers?.['x-fad-retry-count'] ?? 0);
      const reason = this.safeFailureReason(error);

      logger.error(
        {
          categoria: 'notificacoes',
          retry: currentRetry,
          erro: reason,
          messageId: message.properties.messageId,
        },
        'Falha ao processar notificação',
      );

      if (currentRetry >= MAX_RETRIES) {
        await this.rabbit.deadLetter(message, reason);
        return;
      }

      await this.rabbit.retry(message, currentRetry);
    }
  }

  private async handleContact(
    tx: Prisma.TransactionClient,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const inbox = process.env.CONTACT_INBOX;
    if (!inbox || inbox.startsWith('TODO')) {
      throw new Error('CONTACT_INBOX não configurado.');
    }

    const contactMessageId = String(payload.contactMessageId ?? '');
    const contact = contactMessageId
      ? await tx.contactMessage.findUnique({ where: { id: contactMessageId } })
      : null;
    if (!contact || contact.email.endsWith('@privacy.invalid')) return;
    await this.lockSubject(tx, contact.email);
    const fresh = await tx.contactMessage.findUnique({ where: { id: contactMessageId } });
    if (!fresh || fresh.email !== contact.email || fresh.email.endsWith('@privacy.invalid')) {
      return;
    }
    const { name, email, subject, message } = fresh;
    const locale = this.locale(fresh.locale);
    const texts = copy[locale];

    await this.email.send({
      to: inbox,
      subject: `${texts.contactSubject}: ${subject}`,
      text: `Nome: ${name}\nE-mail: ${email}\nAssunto: ${subject}\n\n${message}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#171717">
          <h2>Novo contato pelo portfólio</h2>
          <p><strong>Nome:</strong> ${this.escape(name)}</p>
          <p><strong>E-mail:</strong> ${this.escape(email)}</p>
          <p><strong>Assunto:</strong> ${this.escape(subject)}</p>
          <hr />
          <p>${this.escape(message).replace(/\n/g, '<br>')}</p>
        </div>
      `,
    });

    await this.whatsapp.notifyContact({ name, email, subject });
  }

  private async handleConfirmation(
    tx: Prisma.TransactionClient,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscriberId = String(payload.subscriberId ?? '');
    const tokenId = String(payload.tokenId ?? '');
    const subscriber = subscriberId
      ? await tx.newsletterSubscriber.findUnique({ where: { id: subscriberId } })
      : null;
    if (!subscriber) return;
    await this.lockSubject(tx, subscriber.email);
    const fresh = await tx.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!fresh || fresh.email !== subscriber.email) return;
    const locale = this.locale(fresh.locale);
    const texts = copy[locale];
    const token = this.deriveToken(
      tokenId,
      subscriberId,
      NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
    );
    const base = process.env.WEB_URL ?? 'http://localhost:3000';
    const url = `${base}/${locale}/newsletter/confirm?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: fresh.email,
      subject: texts.confirmSubject,
      text: `${texts.confirmText}\n\n${url}`,
      html: this.layout(texts.confirmTitle, texts.confirmText, texts.confirmButton, url),
    });
  }

  private async handleWelcome(
    tx: Prisma.TransactionClient,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const subscriberId = String(payload.subscriberId ?? '');
    const tokenId = String(payload.unsubscribeTokenId ?? '');
    const subscriber = subscriberId
      ? await tx.newsletterSubscriber.findUnique({ where: { id: subscriberId } })
      : null;
    if (!subscriber) return;
    await this.lockSubject(tx, subscriber.email);
    const fresh = await tx.newsletterSubscriber.findUnique({ where: { id: subscriberId } });
    if (!fresh || fresh.email !== subscriber.email) return;
    const locale = this.locale(fresh.locale);
    const texts = copy[locale];
    const token = this.deriveToken(tokenId, subscriberId, NewsletterTokenPurpose.UNSUBSCRIBE);
    const base = process.env.WEB_URL ?? 'http://localhost:3000';
    const url = `${base}/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: fresh.email,
      subject: texts.welcomeSubject,
      text: `${texts.welcomeText}\n\n${url}`,
      html: this.layout(texts.welcomeTitle, texts.welcomeText, texts.unsubscribe, url),
    });
  }

  private async handlePasswordReset(payload: Record<string, unknown>): Promise<void> {
    const email = String(payload.email ?? '');
    const adminUserId = String(payload.adminUserId ?? '');
    const tokenId = String(payload.tokenId ?? '');

    if (!email || !adminUserId || !tokenId) {
      throw new Error('Evento de recuperação de senha inválido.');
    }

    const token = this.derivePasswordResetToken(tokenId, adminUserId);
    const base = process.env.WEB_URL ?? 'http://localhost:3000';
    const url = `${base}/admin/redefinir-senha?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: email,
      subject: passwordResetCopy.subject,
      text: `${passwordResetCopy.text}\n\n${url}`,
      html: this.layout(
        passwordResetCopy.title,
        passwordResetCopy.text,
        passwordResetCopy.button,
        url,
      ),
    });
  }

  private async handlePrivacyVerification(payload: Record<string, unknown>): Promise<void> {
    await this.prisma.$transaction(
      (tx) => this.handlePrivacyVerificationInTransaction(tx, payload),
      { maxWait: 5_000, timeout: SUBJECT_LOCK_TRANSACTION_TIMEOUT_MS },
    );
  }

  private async handlePrivacyVerificationInTransaction(
    tx: Prisma.TransactionClient,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const requestId = String(payload.requestId ?? '');
    const request = requestId
      ? await tx.privacyRequest.findUnique({ where: { id: requestId } })
      : null;
    if (
      !request ||
      !request.verificationTokenHash ||
      request.status !== PrivacyRequestStatus.PENDING
    ) {
      return;
    }
    if (!request.email || (request.type !== 'EXPORT' && request.type !== 'DELETE')) {
      throw new Error('Evento de verificação de privacidade inválido.');
    }
    await this.lockSubject(tx, request.email);
    const fresh = await tx.privacyRequest.findUnique({ where: { id: requestId } });
    if (
      !fresh ||
      fresh.email !== request.email ||
      !fresh.verificationTokenHash ||
      fresh.status !== PrivacyRequestStatus.PENDING ||
      (fresh.type !== 'EXPORT' && fresh.type !== 'DELETE')
    ) {
      return;
    }

    const locale = this.locale(fresh.locale);
    const token = this.derivePrivacyToken(requestId, fresh.type);
    const base = process.env.WEB_URL ?? 'http://localhost:3000';
    // O fragmento não é enviado ao servidor web nem em Referer, evitando token em access logs.
    const url = `${base}/${locale}/privacidade/verify#token=${encodeURIComponent(token)}`;
    const texts = privacyCopy[locale];
    await this.email.send({
      to: fresh.email,
      subject: texts.subject,
      text: `${texts.text}\n\n${url}`,
      html: this.layout(texts.title, texts.text, texts.button, url),
    });
  }

  private async lockSubject(tx: Prisma.TransactionClient, email: string): Promise<void> {
    const subjectKey = this.privacySubjectKey(email);
    await tx.$executeRaw(Prisma.sql`SET LOCAL lock_timeout = '5000ms'`);
    await tx.$queryRaw(Prisma.sql`
      SELECT 1 AS acquired
      FROM pg_advisory_xact_lock(hashtextextended(${subjectKey}, 0))
    `);
  }

  private privacySubjectKey(email: string): string {
    const secret = process.env.PRIVACY_HASH_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_HASH_SECRET precisa ter pelo menos 32 caracteres.');
    }
    return createHmac('sha256', secret).update(email).digest('hex');
  }

  private safeFailureReason(error: unknown): string {
    if (error instanceof SyntaxError) return 'INVALID_EVENT_PAYLOAD';
    const message = error instanceof Error ? error.message : '';
    if (message === 'INVALID_EVENT_ENVELOPE') return message;
    if (
      /^(?:EMAIL_(?:SMTP|SENDGRID)_(?:REJECTED_(?:\d{3}|UNKNOWN)|TIMEOUT|CONNECTION_FAILED)|WHATSAPP_(?:REJECTED_\d{3}|TIMEOUT|CONNECTION_FAILED))$/.test(
        message,
      )
    ) {
      return message;
    }
    return 'NOTIFICATION_PROCESSING_FAILED';
  }

  private deriveToken(
    tokenId: string,
    subscriberId: string,
    purpose: NewsletterTokenPurpose,
  ): string {
    const configured = process.env.NEWSLETTER_TOKEN_SECRET?.trim();
    const secret =
      configured && !configured.startsWith('gere-')
        ? configured
        : process.env.JWT_REFRESH_SECRET?.trim();

    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error(
        'NEWSLETTER_TOKEN_SECRET ou JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres.',
      );
    }

    const signature = createHmac('sha256', secret)
      .update(`${tokenId}:${subscriberId}:${purpose}`)
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private derivePasswordResetToken(tokenId: string, adminUserId: string): string {
    const configured = process.env.PASSWORD_RESET_TOKEN_SECRET?.trim();
    const secret =
      configured && !configured.startsWith('gere-')
        ? configured
        : process.env.JWT_REFRESH_SECRET?.trim();

    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error(
        'PASSWORD_RESET_TOKEN_SECRET ou JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres.',
      );
    }

    const signature = createHmac('sha256', secret)
      .update(`admin-password-reset:${tokenId}:${adminUserId}`)
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private derivePrivacyToken(requestId: string, type: 'EXPORT' | 'DELETE'): string {
    const secret = process.env.PRIVACY_REQUEST_TOKEN_SECRET?.trim();
    if (!secret || secret.length < 32 || secret.startsWith('gere-')) {
      throw new Error('PRIVACY_REQUEST_TOKEN_SECRET precisa ter pelo menos 32 caracteres.');
    }
    const signature = createHmac('sha256', secret)
      .update(`privacy-request:${requestId}:${type}`)
      .digest('base64url');
    return `${requestId}.${signature}`;
  }

  private locale(value: unknown): PublicLocale {
    if (value === 'en' || value === 'EN') return 'en';
    if (value === 'es' || value === 'ES') return 'es';
    return 'pt-BR';
  }

  private layout(title: string, text: string, button: string, url: string): string {
    return `
      <div style="margin:0;padding:32px;background:#0b0b0c;color:#f5f5f5;font-family:Arial,sans-serif">
        <div style="max-width:620px;margin:auto;padding:32px;border:1px solid #2d2d31;border-radius:24px;background:#151517">
          <div style="font-size:12px;letter-spacing:2px;color:#9a9aa1">FELIPE.DEV</div>
          <h1 style="font-size:30px;margin:18px 0 10px">${this.escape(title)}</h1>
          <p style="color:#c4c4c8;line-height:1.7">${this.escape(text)}</p>
          <p style="margin-top:28px">
            <a href="${this.escape(url)}" style="display:inline-block;padding:13px 20px;border-radius:12px;background:#f4f4f5;color:#111;text-decoration:none;font-weight:700">${this.escape(button)}</a>
          </p>
        </div>
      </div>
    `;
  }

  private escape(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
