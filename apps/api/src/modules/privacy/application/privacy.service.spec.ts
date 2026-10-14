import { BadRequestException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { PrivacyTransaction } from './privacy.ports';
import { PrivacyService } from './privacy.service';

describe('PrivacyService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PRIVACY_REQUEST_TOKEN_SECRET: 'p'.repeat(64),
      PRIVACY_HASH_SECRET: 'h'.repeat(64),
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function setup() {
    const transaction: jest.Mocked<PrivacyTransaction> = {
      getRequest: jest.fn(),
      exportSubject: jest.fn(),
      completeExport: jest.fn(),
      markDeleteVerified: jest.fn(),
      expireRequest: jest.fn(),
      deleteSubject: jest.fn(),
    };
    const repository = {
      createRequest: jest.fn().mockResolvedValue(true),
      withLockedRequest: jest.fn(),
      recordConsent: jest.fn(),
    };
    const rateLimiter = { increment: jest.fn().mockResolvedValue(1) };
    const logger = { info: jest.fn(), warn: jest.fn() };
    const service = new PrivacyService(repository, rateLimiter, logger);
    return { service, repository, rateLimiter, logger, transaction };
  }

  it('cria solicitação localizada sem persistir token em claro nem variar a resposta pública', async () => {
    const { service, repository, rateLimiter } = setup();
    const response = await service.request(
      { email: ' TITULAR@Example.com ', type: 'EXPORT', locale: 'en' },
      '203.0.113.10',
      '11111111-1111-4111-8111-111111111111',
    );

    expect(response).toEqual({
      message: 'If the address is valid, we will send a verification link.',
    });
    expect(rateLimiter.increment).toHaveBeenCalledTimes(2);
    expect(repository.createRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'titular@example.com',
        type: 'EXPORT',
        locale: 'en',
        correlationId: '11111111-1111-4111-8111-111111111111',
        verificationTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        startedAt: expect.any(Date),
      }),
    );
    expect(repository.createRequest.mock.calls[0]![0]).not.toHaveProperty('token');
  });

  it('exporta apenas dados do titular e consome o token uma única vez', async () => {
    const { service, repository, transaction } = setup();
    const requestId = '11111111-1111-4111-8111-111111111111';
    const token = verificationToken(requestId, 'EXPORT');
    const exportData = {
      email: 'titular@example.com',
      contacts: [{ id: 'contact-1' }],
      newsletter: null,
      consents: [],
      privacyRequests: [{ id: requestId }],
    };
    transaction.getRequest.mockResolvedValue({
      id: requestId,
      email: 'titular@example.com',
      type: 'EXPORT',
      status: 'PENDING',
      locale: 'es',
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });
    transaction.exportSubject.mockResolvedValue(exportData);
    repository.withLockedRequest.mockImplementation(async (_hash, execute) =>
      execute(requestId, transaction),
    );

    await expect(service.verify(token)).resolves.toEqual({ type: 'EXPORT', data: exportData });
    expect(transaction.exportSubject).toHaveBeenCalledWith('titular@example.com');
    expect(transaction.completeExport).toHaveBeenCalledWith(requestId, expect.any(Date));

    repository.withLockedRequest.mockResolvedValueOnce(null);
    await expect(service.verify(token)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige confirmação explícita antes de anonimizar e excluir os dados', async () => {
    const { service, repository, transaction } = setup();
    const requestId = '11111111-1111-4111-8111-111111111111';
    transaction.getRequest.mockResolvedValue({
      id: requestId,
      email: 'titular@example.com',
      type: 'DELETE',
      status: 'PENDING',
      locale: 'en',
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });
    repository.withLockedRequest.mockImplementation(async (_hash, execute) =>
      execute(requestId, transaction),
    );

    const first = await service.verify(verificationToken(requestId, 'DELETE'));
    expect(first).toEqual({
      type: 'DELETE',
      confirmationRequired: true,
      confirmationToken: expect.stringMatching(/^[^.]+\.[A-Za-z0-9_-]{43}$/),
    });
    expect(transaction.markDeleteVerified).toHaveBeenCalled();

    transaction.getRequest.mockResolvedValue({
      id: requestId,
      email: 'titular@example.com',
      type: 'DELETE',
      status: 'VERIFIED',
      locale: 'en',
      verificationExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.verify(first.confirmationToken!)).resolves.toEqual({
      type: 'DELETE',
      confirmationRequired: false,
      message: 'Data associated with the verified address was anonymized or deleted.',
    });
    expect(transaction.deleteSubject).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId,
        email: 'titular@example.com',
      }),
    );
  });

  it('registra consentimento mínimo com identificadores pseudonimizados', async () => {
    const { service, repository } = setup();
    const subjectId = '11111111-1111-4111-8111-111111111111';
    await service.recordConsent(
      { subjectId, granted: true, policyVersion: '2026-10-11', locale: 'pt-BR' },
      '203.0.113.10',
    );

    expect(repository.recordConsent).toHaveBeenCalledWith({
      subjectKey: expect.stringMatching(/^[a-f0-9]{64}$/),
      granted: true,
      policyVersion: '2026-10-11',
      locale: 'pt-BR',
      source: 'web-cookie-preferences',
      ipHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      subjectKind: 'ANONYMOUS_BROWSER',
    });
    expect(repository.recordConsent.mock.calls[0]![0].subjectKey).not.toBe(subjectId);
  });

  it('mantém resposta indistinguível quando o limite silencioso do e-mail é excedido', async () => {
    const { service, repository, rateLimiter } = setup();
    rateLimiter.increment.mockResolvedValueOnce(1).mockResolvedValueOnce(4);

    await expect(
      service.request({ email: 'owner@example.com', type: 'EXPORT', locale: 'pt-BR' }, 'ip'),
    ).resolves.toEqual({
      message: 'Se o endereço for válido, enviaremos um link de verificação.',
    });
    expect(repository.createRequest).not.toHaveBeenCalled();
  });

  it('falha fechado em produção quando o rate limit distribuído está indisponível', async () => {
    const { service, rateLimiter } = setup();
    process.env.NODE_ENV = 'production';
    rateLimiter.increment.mockRejectedValue(new Error('redis indisponível'));

    await expect(
      service.request({ email: 'owner@example.com', type: 'EXPORT', locale: 'pt-BR' }, 'ip'),
    ).rejects.toMatchObject({ status: 503 });
  });

  it('expira e anonimiza a solicitação antes de devolver erro genérico', async () => {
    const { service, repository, transaction } = setup();
    const requestId = '11111111-1111-4111-8111-111111111111';
    transaction.getRequest.mockResolvedValue({
      id: requestId,
      email: 'owner@example.com',
      type: 'EXPORT',
      status: 'PENDING',
      locale: 'pt-BR',
      verificationExpiresAt: new Date(Date.now() - 1_000),
    });
    repository.withLockedRequest.mockImplementation(async (_hash, execute) =>
      execute(requestId, transaction),
    );

    await expect(service.verify('x'.repeat(80), 'ip')).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction.expireRequest).toHaveBeenCalledWith(requestId);
  });
});

function verificationToken(requestId: string, type: 'EXPORT' | 'DELETE'): string {
  const signature = createHmac('sha256', 'p'.repeat(64))
    .update(`privacy-request:${requestId}:${type}`)
    .digest('base64url');
  return `${requestId}.${signature}`;
}
