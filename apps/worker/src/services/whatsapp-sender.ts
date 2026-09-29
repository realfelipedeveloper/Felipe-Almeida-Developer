import { logger } from '../infra/logger.js';

export class WhatsAppSender {
  async notifyContact(input: {
    name: string;
    email: string;
    subject: string;
  }): Promise<void> {
    if (process.env.WHATSAPP_ENABLED !== 'true') return;

    const baseUrl = process.env.WHATSAPP_API_URL;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const to = process.env.WHATSAPP_TO_NUMBER;

    if (!baseUrl || !phoneNumberId || !accessToken || !to) {
      logger.warn(
        { categoria: 'whatsapp' },
        'WhatsApp habilitado, mas configuração está incompleta',
      );
      return;
    }

    const response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: `Novo contato no portfólio\nNome: ${input.name}\nE-mail: ${input.email}\nAssunto: ${input.subject}`,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`WhatsApp Cloud API retornou ${response.status}.`);
    }
  }
}
