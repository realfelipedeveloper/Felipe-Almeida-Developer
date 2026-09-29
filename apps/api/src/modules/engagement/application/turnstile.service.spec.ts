import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const originalEnv = process.env;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.TURNSTILE_SECRET_KEY;
    globalThis.fetch = originalFetch;
  });

  afterAll(() => {
    process.env = originalEnv;
    globalThis.fetch = originalFetch;
  });

  it('não exige Turnstile quando a integração está desabilitada', async () => {
    const service = new TurnstileService();
    await expect(
      service.verify(undefined, '127.0.0.1', 'pt-BR'),
    ).resolves.toBeUndefined();
  });

  it('recusa requisição sem token quando Turnstile está habilitado', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
    const service = new TurnstileService();

    await expect(
      service.verify('', '127.0.0.1', 'pt-BR'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('aceita token validado pela Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    }) as unknown as typeof fetch;

    const service = new TurnstileService();

    await expect(
      service.verify('token-valido', '127.0.0.1', 'pt-BR'),
    ).resolves.toBeUndefined();
  });

  it('recusa token rejeitado pela Cloudflare', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    }) as unknown as typeof fetch;

    const service = new TurnstileService();

    await expect(
      service.verify('token-invalido', '127.0.0.1', 'pt-BR'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('falha de forma fechada se o serviço anti-bot estiver indisponível', async () => {
    process.env.TURNSTILE_SECRET_KEY = 'segredo-de-teste';
    globalThis.fetch = jest
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const service = new TurnstileService();

    await expect(
      service.verify('token', '127.0.0.1', 'pt-BR'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
