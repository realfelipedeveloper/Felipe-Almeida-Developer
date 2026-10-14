import { logger } from '../infra/logger.js';

const WHATSAPP_DELIVERY_TIMEOUT_MS = 8_000;

export class WhatsAppSender {
  async notifyContact(input: { name: string; email: string; subject: string }): Promise<void> {
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

    const signal = AbortSignal.timeout(WHATSAPP_DELIVERY_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/${phoneNumberId}/messages`, {
        method: 'POST',
        signal,
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
    } catch {
      throw new Error(signal.aborted ? 'WHATSAPP_TIMEOUT' : 'WHATSAPP_CONNECTION_FAILED');
    }

    if (!response.ok) {
      await response.text().catch(() => undefined);
      throw new Error(`WHATSAPP_REJECTED_${response.status}`);
    }
  }
}
