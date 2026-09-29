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
  private waiters: Array<(value: string) => void> = [];

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
      logger.error({ categoria: 'email', erro: error.message }, 'Falha no socket SMTP');
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
    if (!this.socket) return;
    try {
      await this.command('QUIT', [221]);
    } catch {
      // O servidor pode encerrar a conexão imediatamente após QUIT.
    }
    this.socket.end();
    this.socket = null;
  }

  private async command(command: string, expected: number[]): Promise<string> {
    if (!this.socket) throw new Error('SMTP não conectado.');
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  private async expect(expected: number[]): Promise<string> {
    const response = await new Promise<string>((resolve) => {
      this.waiters.push(resolve);
      this.flush();
    });
    const code = Number(response.slice(0, 3));
    if (!expected.includes(code)) {
      throw new Error(`SMTP respondeu ${code}: ${response.trim()}`);
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
    waiter(response);
  }
}

export class EmailSender {
  async send(message: EmailMessage): Promise<void> {
    const provider = (process.env.EMAIL_PROVIDER ?? 'smtp').toLowerCase();

    if (provider === 'sendgrid') {
      await this.sendWithSendGrid(message);
      return;
    }

    const client = new SmtpClient();
    try {
      await client.connect();
      await client.send(message);
    } finally {
      await client.close();
    }
  }

  private async sendWithSendGrid(message: EmailMessage): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY não configurada.');

    const from = mailFromAddress();
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
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

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SendGrid retornou ${response.status}: ${body.slice(0, 500)}`);
    }
  }
}
