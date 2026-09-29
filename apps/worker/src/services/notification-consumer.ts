import {
  PrismaClient,
  NewsletterTokenPurpose,
} from '@prisma/client';
import { createHmac } from 'node:crypto';
import type { ConsumeMessage } from 'amqplib';
import { RabbitConnection } from '../infra/rabbitmq.js';
import { logger } from '../infra/logger.js';
import { EmailSender } from './email-sender.js';
import { WhatsAppSender } from './whatsapp-sender.js';

const CONSUMER_NAME =
  'worker.notifications.v1';
const MAX_RETRIES = 5;

type PublicLocale =
  | 'pt-BR'
  | 'en'
  | 'es';

interface EventEnvelope {
  eventId: string;
  eventName: string;
  occurredAt: string;
  correlationId: string;
  version: number;
  payload: Record<string, unknown>;
}

const copy = {
  'pt-BR': {
    confirmSubject:
      'Confirme sua inscrição na newsletter',
    confirmTitle: 'Falta só confirmar.',
    confirmText:
      'Clique no botão abaixo para confirmar que deseja receber a newsletter.',
    confirmButton:
      'Confirmar inscrição',
    welcomeSubject:
      'Inscrição confirmada',
    welcomeTitle: 'Tudo certo.',
    welcomeText:
      'Sua inscrição foi confirmada. Você pode cancelar a qualquer momento pelo link abaixo.',
    unsubscribe:
      'Cancelar inscrição',
    contactSubject:
      'Novo contato pelo portfólio',
  },
  en: {
    confirmSubject:
      'Confirm your newsletter subscription',
    confirmTitle: 'One last step.',
    confirmText:
      'Use the button below to confirm that you want to receive the newsletter.',
    confirmButton:
      'Confirm subscription',
    welcomeSubject:
      'Subscription confirmed',
    welcomeTitle:
      'You are all set.',
    welcomeText:
      'Your subscription is confirmed. You can unsubscribe at any time using the link below.',
    unsubscribe: 'Unsubscribe',
    contactSubject:
      'New portfolio contact',
  },
  es: {
    confirmSubject:
      'Confirma tu suscripción a la newsletter',
    confirmTitle:
      'Solo falta confirmar.',
    confirmText:
      'Usa el botón para confirmar que deseas recibir la newsletter.',
    confirmButton:
      'Confirmar suscripción',
    welcomeSubject:
      'Suscripción confirmada',
    welcomeTitle: 'Todo listo.',
    welcomeText:
      'Tu suscripción está confirmada. Puedes cancelarla cuando quieras desde el enlace inferior.',
    unsubscribe:
      'Cancelar suscripción',
    contactSubject:
      'Nuevo contacto desde el portafolio',
  },
} satisfies Record<
  PublicLocale,
  Record<string, string>
>;

const passwordResetCopy = {
  subject:
    'Recuperação de senha administrativa',
  title: 'Redefina sua senha.',
  text:
    'Recebemos uma solicitação para redefinir a senha do painel administrativo. O link abaixo é válido por 30 minutos e pode ser usado apenas uma vez. Se você não solicitou esta alteração, ignore esta mensagem.',
  button: 'Redefinir senha',
};

export class NotificationConsumer {
  private readonly email =
    new EmailSender();
  private readonly whatsapp =
    new WhatsAppSender();

  constructor(
    private readonly prisma: PrismaClient,
    private readonly rabbit: RabbitConnection,
  ) {}

  async start(): Promise<void> {
    await this.rabbit.consumeNotifications(
      (message) =>
        this.handle(message),
    );
  }

  private async handle(
    message: ConsumeMessage,
  ): Promise<void> {
    try {
      const event = JSON.parse(
        message.content.toString('utf8'),
      ) as EventEnvelope;

      const existing =
        await this.prisma.processedEvent.findUnique(
          {
            where: {
              eventId_consumer: {
                eventId: event.eventId,
                consumer: CONSUMER_NAME,
              },
            },
          },
        );

      if (existing) {
        this.rabbit.ack(message);
        return;
      }

      if (
        event.eventName ===
        'contact.created'
      ) {
        await this.handleContact(
          event.payload,
        );
      } else if (
        event.eventName ===
        'newsletter.confirmation.requested'
      ) {
        await this.handleConfirmation(
          event.payload,
        );
      } else if (
        event.eventName ===
        'newsletter.confirmed'
      ) {
        await this.handleWelcome(
          event.payload,
        );
      } else if (
        event.eventName ===
        'admin.password-reset.requested'
      ) {
        await this.handlePasswordReset(
          event.payload,
        );
      }

      await this.prisma.processedEvent.create(
        {
          data: {
            eventId: event.eventId,
            consumer: CONSUMER_NAME,
          },
        },
      );

      this.rabbit.ack(message);
    } catch (error) {
      const currentRetry = Number(
        message.properties.headers?.[
          'x-fad-retry-count'
        ] ?? 0,
      );

      const reason =
        error instanceof Error
          ? error.message
          : String(error);

      logger.error(
        {
          categoria: 'notificacoes',
          retry: currentRetry,
          erro: reason,
          messageId:
            message.properties.messageId,
        },
        'Falha ao processar notificação',
      );

      if (
        currentRetry >=
        MAX_RETRIES
      ) {
        await this.rabbit.deadLetter(
          message,
          reason,
        );
        return;
      }

      await this.rabbit.retry(
        message,
        currentRetry,
      );
    }
  }

  private async handleContact(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const inbox =
      process.env.CONTACT_INBOX;

    if (
      !inbox ||
      inbox.startsWith('TODO')
    ) {
      throw new Error(
        'CONTACT_INBOX não configurado.',
      );
    }

    const name = String(
      payload.name ?? '',
    );
    const email = String(
      payload.email ?? '',
    );
    const subject = String(
      payload.subject ?? '',
    );
    const message = String(
      payload.message ?? '',
    );
    const locale = this.locale(
      payload.locale,
    );
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

    await this.whatsapp.notifyContact({
      name,
      email,
      subject,
    });
  }

  private async handleConfirmation(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const locale = this.locale(
      payload.locale,
    );
    const texts = copy[locale];
    const email = String(
      payload.email ?? '',
    );
    const subscriberId = String(
      payload.subscriberId ?? '',
    );
    const tokenId = String(
      payload.tokenId ?? '',
    );

    const token =
      this.deriveNewsletterToken(
        tokenId,
        subscriberId,
        NewsletterTokenPurpose.CONFIRM_SUBSCRIPTION,
      );

    const base =
      process.env.WEB_URL ??
      'http://localhost:3000';

    const url =
      `${base}/${locale}/newsletter/confirm?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: email,
      subject: texts.confirmSubject,
      text: `${texts.confirmText}\n\n${url}`,
      html: this.layout(
        texts.confirmTitle,
        texts.confirmText,
        texts.confirmButton,
        url,
      ),
    });
  }

  private async handleWelcome(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const locale = this.locale(
      payload.locale,
    );
    const texts = copy[locale];
    const email = String(
      payload.email ?? '',
    );
    const subscriberId = String(
      payload.subscriberId ?? '',
    );
    const tokenId = String(
      payload.unsubscribeTokenId ?? '',
    );

    const token =
      this.deriveNewsletterToken(
        tokenId,
        subscriberId,
        NewsletterTokenPurpose.UNSUBSCRIBE,
      );

    const base =
      process.env.WEB_URL ??
      'http://localhost:3000';

    const url =
      `${base}/${locale}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: email,
      subject: texts.welcomeSubject,
      text: `${texts.welcomeText}\n\n${url}`,
      html: this.layout(
        texts.welcomeTitle,
        texts.welcomeText,
        texts.unsubscribe,
        url,
      ),
    });
  }

  private async handlePasswordReset(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const email = String(
      payload.email ?? '',
    );
    const adminUserId = String(
      payload.adminUserId ?? '',
    );
    const tokenId = String(
      payload.tokenId ?? '',
    );

    if (
      !email ||
      !adminUserId ||
      !tokenId
    ) {
      throw new Error(
        'Evento de recuperação de senha inválido.',
      );
    }

    const token =
      this.derivePasswordResetToken(
        tokenId,
        adminUserId,
      );

    const base =
      process.env.WEB_URL ??
      'http://localhost:3000';

    const url =
      `${base}/admin/redefinir-senha?token=${encodeURIComponent(token)}`;

    await this.email.send({
      to: email,
      subject:
        passwordResetCopy.subject,
      text:
        `${passwordResetCopy.text}\n\n${url}`,
      html: this.layout(
        passwordResetCopy.title,
        passwordResetCopy.text,
        passwordResetCopy.button,
        url,
      ),
    });
  }

  private deriveNewsletterToken(
    tokenId: string,
    subscriberId: string,
    purpose: NewsletterTokenPurpose,
  ): string {
    const configured =
      process.env.NEWSLETTER_TOKEN_SECRET?.trim();

    const secret =
      configured &&
      !configured.startsWith('gere-')
        ? configured
        : process.env.JWT_REFRESH_SECRET?.trim();

    if (
      !secret ||
      secret.length < 32 ||
      secret.startsWith('gere-')
    ) {
      throw new Error(
        'NEWSLETTER_TOKEN_SECRET ou JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres.',
      );
    }

    const signature = createHmac(
      'sha256',
      secret,
    )
      .update(
        `${tokenId}:${subscriberId}:${purpose}`,
      )
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private derivePasswordResetToken(
    tokenId: string,
    adminUserId: string,
  ): string {
    const secret =
      process.env.JWT_REFRESH_SECRET?.trim();

    if (
      !secret ||
      secret.length < 32 ||
      secret.startsWith('gere-')
    ) {
      throw new Error(
        'JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres para recuperação de senha.',
      );
    }

    const signature = createHmac(
      'sha256',
      secret,
    )
      .update(
        `admin-password-reset:${tokenId}:${adminUserId}`,
      )
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private locale(
    value: unknown,
  ): PublicLocale {
    return value === 'en' ||
      value === 'es'
      ? value
      : 'pt-BR';
  }

  private layout(
    title: string,
    text: string,
    button: string,
    url: string,
  ): string {
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

  private escape(
    value: string,
  ): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
