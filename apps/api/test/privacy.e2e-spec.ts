import 'reflect-metadata';

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TurnstileService } from '../src/modules/engagement/application/turnstile.service';
import { PrivacyService } from '../src/modules/privacy/application/privacy.service';
import { PrivacyController } from '../src/modules/privacy/presentation/privacy.controller';

describe('contratos públicos de privacidade (e2e sem infraestrutura externa)', () => {
  let app: INestApplication;
  let baseUrl: string;
  const privacy = {
    request: jest.fn(),
    verify: jest.fn(),
    recordConsent: jest.fn(),
  };
  const turnstile = { verify: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [
        { provide: PrivacyService, useValue: privacy },
        { provide: TurnstileService, useValue: turnstile },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') throw new Error('Porta E2E indisponível.');
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    privacy.request.mockResolvedValue({
      message: 'Se o endereço for válido, enviaremos um link de verificação.',
    });
    privacy.verify.mockResolvedValue({ type: 'EXPORT', data: { email: 'owner@example.com' } });
    privacy.recordConsent.mockResolvedValue(undefined);
    turnstile.verify.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    await app.close();
  });

  it('aceita solicitação válida e encaminha idioma e proteção anti-bot', async () => {
    const response = await fetch(`${baseUrl}/api/privacy/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        type: 'EXPORT',
        locale: 'en',
        turnstileToken: 'captcha-token',
      }),
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      message: 'Se o endereço for válido, enviaremos um link de verificação.',
    });
    expect(turnstile.verify).toHaveBeenCalledWith('captcha-token', expect.any(String), 'en');
    expect(privacy.request).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'owner@example.com', type: 'EXPORT', locale: 'en' }),
      expect.any(String),
      undefined,
    );
  });

  it('rejeita tipo, locale e propriedades não permitidas', async () => {
    const response = await fetch(`${baseUrl}/api/privacy/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'owner@example.com',
        type: 'DOWNLOAD_ALL',
        locale: 'fr',
        unexpected: true,
      }),
    });
    expect(response.status).toBe(400);
    expect(privacy.request).not.toHaveBeenCalled();
  });

  it('valida token de uso único antes de concluir a solicitação', async () => {
    const invalid = await fetch(`${baseUrl}/api/privacy/requests/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'curto' }),
    });
    expect(invalid.status).toBe(400);

    const token = `${'1'.repeat(36)}.${'a'.repeat(43)}`;
    const valid = await fetch(`${baseUrl}/api/privacy/requests/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    expect(valid.status).toBe(200);
    expect(privacy.verify).toHaveBeenCalledWith(token, expect.any(String));
  });

  it('registra somente decisões de consentimento com sujeito UUID', async () => {
    const payload = {
      subjectId: '11111111-1111-4111-8111-111111111111',
      granted: false,
      policyVersion: '2026-10-11',
      locale: 'pt-BR',
    };
    const response = await fetch(`${baseUrl}/api/privacy/consents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ recorded: true });
    expect(privacy.recordConsent).toHaveBeenCalledWith(payload, expect.any(String));
  });
});
