import net from 'node:net';
import tls from 'node:tls';
import { Buffer } from 'node:buffer';
import { logger } from '../infra/logger.js';

interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

type SmtpSocket = net.Socket | tls.TLSSocket;
type SmtpWaiter = {
  resolve: (value: string) => void;
  reject: (error: Error) => void;
};

const DEFAULT_EMAIL_DELIVERY_TIMEOUT_MS = 8_000;

function emailDeliveryTimeoutMs(): number {
  const testValue = Number(process.env.EMAIL_DELIVERY_TIMEOUT_MS);
  return process.env.NODE_ENV === 'test' && Number.isInteger(testValue) && testValue >= 50
    ? testValue
    : DEFAULT_EMAIL_DELIVERY_TIMEOUT_MS;
}

function mailFromAddress(): string {
  const value = process.env.MAIL_FROM?.trim() || 'Felipe Almeida Developer <no-reply@localhost>';
  return value.match(/<([^>]+)>/)?.[1] ?? value;
}

function encodeSubject(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

function dotStuff(value: string): string {
  return value.replace(/(^|\r?\n)\./g, '$1..');
}

class SmtpClient {
  private socket: SmtpSocket | null = null;
  private buffered = '';
  private waiters: SmtpWaiter[] = [];

  async connect(): Promise<void> {
    const host = process.env.SMTP_HOST ?? 'localhost';
    const port = Number(process.env.SMTP_PORT ?? 1025);
    const secure = process.env.SMTP_SECURE === 'true';

    this.socket = secure
      ? tls.connect({ host, port, servername: host })
      : net.createConnection({ host, port });

    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => this.onData(chunk));
    this.socket.on('error', (error) => {
      logger.error({ categoria: 'email', codigo: error.name }, 'Falha no socket SMTP');
      this.rejectWaiters(new Error('EMAIL_SMTP_CONNECTION_FAILED'));
    });

    await this.expect([220]);
    await this.command(`EHLO ${process.env.APP_NAME?.replace(/\s+/g, '-') || 'felipe-dev'}`, [250]);

    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    if (user && password) {
      await this.command('AUTH LOGIN', [334]);
      await this.command(Buffer.from(user).toString('base64'), [334]);
      await this.command(Buffer.from(password).toString('base64'), [235]);
    }
  }

  async send(message: EmailMessage): Promise<void> {
    if (!this.socket) throw new Error('SMTP não conectado.');

    await this.command(`MAIL FROM:<${mailFromAddress()}>`, [250]);
    await this.command(`RCPT TO:<${message.to}>`, [250, 251]);
    await this.command('DATA', [354]);

    const payload = [
      `From: ${process.env.MAIL_FROM || 'Felipe Almeida Developer <no-reply@localhost>'}`,
      `To: ${message.to}`,
      `Subject: ${encodeSubject(message.subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: multipart/alternative; boundary="fad-boundary"',
      '',
      '--fad-boundary',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.text,
      '',
      '--fad-boundary',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      message.html,
      '',
      '--fad-boundary--',
      '',
    ].join('\r\n');

    this.socket.write(`${dotStuff(payload)}\r\n.\r\n`);
    await this.expect([250]);
  }

  async close(): Promise<void> {
    const socket = this.socket;
    if (!socket) return;
    try {
      await this.command('QUIT', [221]);
    } catch {
      // O servidor pode encerrar a conexão imediatamente após QUIT.
    } finally {
      socket.end();
      if (this.socket === socket) this.socket = null;
    }
  }

  abort(): void {
    this.rejectWaiters(new Error('EMAIL_SMTP_TIMEOUT'));
    this.socket?.destroy();
    this.socket = null;
  }

  private async command(command: string, expected: number[]): Promise<string> {
    if (!this.socket) throw new Error('SMTP não conectado.');
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  private async expect(expected: number[]): Promise<string> {
    const response = await new Promise<string>((resolve, reject) => {
      this.waiters.push({ resolve, reject });
      this.flush();
    });
    const code = Number(response.slice(0, 3));
    if (!expected.includes(code)) {
      throw new Error(`EMAIL_SMTP_REJECTED_${Number.isFinite(code) ? code : 'UNKNOWN'}`);
    }
    return response;
  }

  private onData(chunk: string): void {
    this.buffered += chunk;
    this.flush();
  }

  private flush(): void {
    const waiter = this.waiters[0];
    if (!waiter) return;

    const lines = this.buffered.split(/\r?\n/);
    let end = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (/^\d{3} /.test(lines[index] ?? '')) {
        end = index;
        break;
      }
    }
    if (end < 0) return;

    const response = lines.slice(0, end + 1).join('\r\n');
    this.buffered = lines.slice(end + 1).join('\r\n');
    this.waiters.shift();
    waiter.resolve(response);
  }

  private rejectWaiters(error: Error): void {
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }
}

export class EmailSender {
  async send(message: EmailMessage): Promise<void> {
    const provider = (process.env.EMAIL_PROVIDER ?? 'smtp').toLowerCase();

    if (provider === 'sendgrid') {
      await this.sendWithSendGrid(message);
      return;
    }

    await this.sendWithSmtp(message);
  }

  private async sendWithSmtp(message: EmailMessage): Promise<void> {
    const client = new SmtpClient();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          try {
            await client.connect();
            await client.send(message);
          } finally {
            await client.close();
          }
        })(),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => {
            client.abort();
            reject(new Error('EMAIL_SMTP_TIMEOUT'));
          }, emailDeliveryTimeoutMs());
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
      client.abort();
    }
  }

  private async sendWithSendGrid(message: EmailMessage): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY não configurada.');

    const from = mailFromAddress();
    const signal = AbortSignal.timeout(emailDeliveryTimeoutMs());
    let response: Response;
    try {
      response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: message.to }] }],
          from: { email: from },
          subject: message.subject,
          content: [
            { type: 'text/plain', value: message.text },
            { type: 'text/html', value: message.html },
          ],
        }),
      });
    } catch {
      throw new Error(
        signal.aborted ? 'EMAIL_SENDGRID_TIMEOUT' : 'EMAIL_SENDGRID_CONNECTION_FAILED',
      );
    }

    if (!response.ok) {
      await response.text().catch(() => undefined);
      throw new Error(`EMAIL_SENDGRID_REJECTED_${response.status}`);
    }
  }
}
