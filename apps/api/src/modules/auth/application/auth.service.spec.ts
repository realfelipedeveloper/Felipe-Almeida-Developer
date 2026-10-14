import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../../infra/prisma/prisma.service';
import type { RedisService } from '../../../infra/redis/redis.service';
import type { AppLogger } from '../../../infra/logging/app-logger.service';
import { AuthService } from './auth.service';
import type { AdminAccount, AdminAuthRepository, AdminSessionData } from './auth.types';
import type { PasswordService } from './password.service';
import type { TokenService } from './token.service';

const account: AdminAccount = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  passwordHash: '$argon2$atual',
  role: 'SUPER_ADMIN',
  active: true,
  mustChangePassword: false,
  lastLoginAt: null,
};

const session: AdminSessionData = {
  id: '22222222-2222-4222-8222-222222222222',
  adminUserId: account.id,
  refreshTokenHash: 'hash-refresh',
  userAgent: null,
  ipHash: null,
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function createFixture() {
  const repository = {
    countAdmins: jest.fn().mockResolvedValue(1),
    createAdmin: jest.fn().mockResolvedValue(account),
    findAdminByEmail: jest.fn().mockResolvedValue(account),
    findAdminById: jest.fn().mockResolvedValue(account),
    createSession: jest.fn().mockResolvedValue(session),
    findActiveSessionById: jest.fn().mockResolvedValue(session),
    rotateSession: jest.fn().mockResolvedValue(undefined),
    revokeSession: jest.fn().mockResolvedValue(undefined),
    revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    updateSuccessfulLogin: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
  };
  const passwords = {
    verify: jest.fn().mockResolvedValue(true),
    hash: jest.fn().mockResolvedValue('$argon2$novo'),
  };
  const issued = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    accessMaxAgeSeconds: 900,
    refreshMaxAgeSeconds: 604800,
    refreshExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
  };
  const tokens = {
    issue: jest.fn().mockResolvedValue(issued),
    verifyAccess: jest.fn().mockResolvedValue({ sub: account.id, sessionId: session.id }),
    verifyRefresh: jest.fn().mockResolvedValue({ sub: account.id, sessionId: session.id }),
    hashToken: jest.fn().mockReturnValue('hash-refresh'),
  };
  const transaction = {
    del: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  };
  const connection = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(1),
    multi: jest.fn().mockReturnValue(transaction),
  };
  const redis = { connection };
  const auditCreate = jest.fn().mockResolvedValue({});
  const outboxCreate = jest.fn().mockResolvedValue({});
  const prisma = {
    auditLog: { create: auditCreate },
    outboxEvent: { create: outboxCreate },
  };
  const scopedLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const logger = { child: jest.fn().mockReturnValue(scopedLogger) };
  const service = new AuthService(
    repository as unknown as AdminAuthRepository,
    passwords as unknown as PasswordService,
    tokens as unknown as TokenService,
    redis as unknown as RedisService,
    prisma as unknown as PrismaService,
    logger as unknown as AppLogger,
  );

  return {
    service,
    repository,
    passwords,
    tokens,
    connection,
    transaction,
    auditCreate,
    outboxCreate,
    scopedLogger,
  };
}

describe('AuthService', () => {
  const originalEnvironment = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      JWT_ACCESS_SECRET: 'a'.repeat(40),
      JWT_REFRESH_SECRET: 'b'.repeat(40),
      PASSWORD_RESET_TOKEN_SECRET: 'c'.repeat(40),
    };
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  it('autentica, normaliza e cria uma sessão auditada', async () => {
    const fixture = createFixture();
    const result = await fixture.service.login('  ADMIN@EXAMPLE.COM ', 'senha', 'x'.repeat(600), '127.0.0.1');

    expect(fixture.repository.findAdminByEmail).toHaveBeenCalledWith('admin@example.com');
    expect(fixture.connection.del).toHaveBeenCalled();
    expect(fixture.repository.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: account.id,
        userAgent: 'x'.repeat(500),
        ipHash: expect.any(String),
      }),
    );
    expect(fixture.repository.updateSuccessfulLogin).toHaveBeenCalled();
    expect(fixture.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'AUTH_LOGIN_SUCCESS' }) }),
    );
    expect(result).toEqual(expect.objectContaining({ accessToken: 'access-token', csrfToken: expect.any(String) }));
  });

  it('rejeita credenciais inválidas e registra tentativa sem depender do Redis', async () => {
    const fixture = createFixture();
    fixture.repository.findAdminByEmail.mockResolvedValue(null);
    fixture.connection.incr.mockRejectedValue(new Error('redis down'));

    await expect(fixture.service.login('nobody@example.com', 'incorreta')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(fixture.scopedLogger.warn).toHaveBeenCalled();
  });

  it('bloqueia login após o limite e degrada quando a consulta de rate limit falha', async () => {
    const limited = createFixture();
    limited.connection.get.mockResolvedValue('5');
    await expect(limited.service.login(account.email, 'senha')).rejects.toBeInstanceOf(HttpException);
    expect(limited.repository.findAdminByEmail).not.toHaveBeenCalled();

    const degraded = createFixture();
    degraded.connection.get.mockRejectedValue(new Error('redis down'));
    await expect(degraded.service.login(account.email, 'senha')).resolves.toBeDefined();
    expect(degraded.scopedLogger.warn).toHaveBeenCalled();
  });

  it('mantém resposta indistinguível para recuperação de conta inexistente', async () => {
    const fixture = createFixture();
    fixture.repository.findAdminByEmail.mockResolvedValue(null);

    await expect(fixture.service.requestPasswordReset('NONE@example.com')).resolves.toEqual({
      message: expect.stringContaining('Se existir uma conta'),
    });
    expect(fixture.outboxCreate).not.toHaveBeenCalled();
  });

  it('substitui token anterior e publica recuperação para conta ativa', async () => {
    const fixture = createFixture();
    fixture.connection.get.mockResolvedValue('token-anterior');

    await fixture.service.requestPasswordReset(account.email, '127.0.0.1');

    expect(fixture.connection.incr).toHaveBeenCalled();
    expect(fixture.connection.expire).toHaveBeenCalled();
    expect(fixture.transaction.del).toHaveBeenCalledWith(
      'auth:admin:recuperacao:token:token-anterior',
    );
    expect(fixture.transaction.set).toHaveBeenCalledTimes(2);
    expect(fixture.outboxCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventName: 'admin.password-reset.requested' }),
      }),
    );
  });

  it('limita recuperação e compensa Redis quando a outbox falha', async () => {
    const limited = createFixture();
    limited.connection.incr.mockResolvedValue(6);
    await expect(limited.service.requestPasswordReset(account.email)).rejects.toBeInstanceOf(
      HttpException,
    );

    const failed = createFixture();
    failed.outboxCreate.mockRejectedValue(new Error('database down'));
    await expect(failed.service.requestPasswordReset(account.email)).resolves.toBeDefined();
    expect(failed.connection.eval).toHaveBeenCalledTimes(2);
    expect(failed.scopedLogger.error).toHaveBeenCalled();
  });

  it('rejeita formatos, registros e assinaturas inválidas na redefinição', async () => {
    const malformed = createFixture();
    await expect(malformed.service.resetPassword('inválido', 'nova')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const absent = createFixture();
    absent.connection.get.mockResolvedValue(null);
    await expect(
      absent.service.resetPassword(`11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`, 'nova'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const invalidEntry = createFixture();
    invalidEntry.connection.get.mockResolvedValue('{"adminUserId":1}');
    await expect(
      invalidEntry.service.resetPassword(
        `11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`,
        'nova',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    const signature = createFixture();
    signature.connection.get.mockResolvedValue(
      JSON.stringify({ adminUserId: account.id, signatureHash: '$argon2$assinatura' }),
    );
    signature.passwords.verify.mockResolvedValue(false);
    await expect(
      signature.service.resetPassword(
        `11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`,
        'nova',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('consome token uma única vez, altera senha e revoga sessões', async () => {
    const fixture = createFixture();
    const tokenId = '11111111-1111-4111-8111-111111111111';
    fixture.connection.get.mockResolvedValue(
      JSON.stringify({ adminUserId: account.id, signatureHash: '$argon2$assinatura' }),
    );
    fixture.passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    await expect(
      fixture.service.resetPassword(`${tokenId}.${'a'.repeat(43)}`, 'nova-senha'),
    ).resolves.toEqual({ message: expect.stringContaining('sucesso') });
    expect(fixture.repository.updatePassword).toHaveBeenCalledWith(
      expect.objectContaining({ adminUserId: account.id, mustChangePassword: false }),
    );
    expect(fixture.repository.revokeAllSessions).toHaveBeenCalledWith(account.id, expect.any(Date));
    expect(fixture.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'AUTH_PASSWORD_RESET_COMPLETED' }),
      }),
    );
  });

  it('rejeita redefinição para conta inativa, senha repetida ou token já consumido', async () => {
    const token = `11111111-1111-4111-8111-111111111111.${'a'.repeat(43)}`;
    const inactive = createFixture();
    inactive.connection.get.mockResolvedValue(
      JSON.stringify({ adminUserId: account.id, signatureHash: '$argon2$assinatura' }),
    );
    inactive.repository.findAdminById.mockResolvedValue({ ...account, active: false });
    await expect(inactive.service.resetPassword(token, 'nova')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    const repeated = createFixture();
    repeated.connection.get.mockResolvedValue(
      JSON.stringify({ adminUserId: account.id, signatureHash: '$argon2$assinatura' }),
    );
    repeated.passwords.verify.mockResolvedValue(true);
    await expect(repeated.service.resetPassword(token, 'atual')).rejects.toThrow(
      'A nova senha deve ser diferente',
    );

    const consumed = createFixture();
    consumed.connection.get.mockResolvedValue(
      JSON.stringify({ adminUserId: account.id, signatureHash: '$argon2$assinatura' }),
    );
    consumed.passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    consumed.connection.eval.mockResolvedValue(0);
    await expect(consumed.service.resetPassword(token, 'nova')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rotaciona refresh válido e rejeita sessão, hash ou conta inválidos', async () => {
    const valid = createFixture();
    await expect(valid.service.refresh('refresh')).resolves.toEqual(
      expect.objectContaining({ refreshToken: 'refresh-token', csrfToken: expect.any(String) }),
    );
    expect(valid.repository.rotateSession).toHaveBeenCalled();

    const missing = createFixture();
    missing.repository.findActiveSessionById.mockResolvedValue(null);
    await expect(missing.service.refresh('refresh')).rejects.toBeInstanceOf(UnauthorizedException);

    const wrongHash = createFixture();
    wrongHash.tokens.hashToken.mockReturnValue('outro-hash');
    await expect(wrongHash.service.refresh('refresh')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(wrongHash.repository.revokeSession).toHaveBeenCalled();

    const inactive = createFixture();
    inactive.repository.findAdminById.mockResolvedValue({ ...account, active: false });
    await expect(inactive.service.refresh('refresh')).rejects.toThrow(
      'Conta administrativa indisponível',
    );
  });

  it('faz logout idempotente e encerra todas as sessões quando solicitado', async () => {
    const fixture = createFixture();
    await fixture.service.logout(undefined);
    fixture.tokens.verifyRefresh.mockRejectedValueOnce(new Error('token inválido'));
    await expect(fixture.service.logout('inválido')).resolves.toBeUndefined();
    await fixture.service.logout('válido');
    expect(fixture.repository.revokeSession).toHaveBeenCalled();

    await fixture.service.logoutAll({
      id: account.id,
      email: account.email,
      role: account.role,
      sessionId: session.id,
      mustChangePassword: false,
    });
    expect(fixture.repository.revokeAllSessions).toHaveBeenCalled();
  });

  it('altera senha válida e rejeita conta, senha atual ou senha repetida', async () => {
    const admin = {
      id: account.id,
      email: account.email,
      role: account.role,
      sessionId: session.id,
      mustChangePassword: false,
    };
    const valid = createFixture();
    valid.passwords.verify.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(valid.service.changePassword(admin, 'atual', 'nova')).resolves.toBeDefined();
    expect(valid.repository.updatePassword).toHaveBeenCalled();

    const unavailable = createFixture();
    unavailable.repository.findAdminById.mockResolvedValue(null);
    await expect(unavailable.service.changePassword(admin, 'a', 'b')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const wrong = createFixture();
    wrong.passwords.verify.mockResolvedValue(false);
    await expect(wrong.service.changePassword(admin, 'a', 'b')).rejects.toThrow(
      'Senha atual incorreta',
    );

    const repeated = createFixture();
    repeated.passwords.verify.mockResolvedValue(true);
    await expect(repeated.service.changePassword(admin, 'a', 'a')).rejects.toThrow(
      'A nova senha deve ser diferente',
    );
  });

  it('resolve acesso somente para sessão pertencente a conta ativa', async () => {
    const valid = createFixture();
    await expect(valid.service.resolveAccessToken('access')).resolves.toEqual(
      expect.objectContaining({ id: account.id, sessionId: session.id }),
    );

    const invalid = createFixture();
    invalid.repository.findActiveSessionById.mockResolvedValue({
      ...session,
      adminUserId: '33333333-3333-4333-8333-333333333333',
    });
    await expect(invalid.service.resolveAccessToken('access')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('cria o primeiro SUPER_ADMIN somente com configuração elegível', async () => {
    process.env.ADMIN_EMAIL = 'FIRST@example.com';
    process.env.ADMIN_INITIAL_PASSWORD = 'senha-inicial-segura';
    const fixture = createFixture();
    fixture.repository.countAdmins.mockResolvedValue(0);

    await fixture.service.onModuleInit();

    expect(fixture.repository.createAdmin).toHaveBeenCalledWith({
      email: 'first@example.com',
      passwordHash: '$argon2$novo',
      role: 'SUPER_ADMIN',
    });

    process.env.ADMIN_INITIAL_PASSWORD = '123';
    const weak = createFixture();
    weak.repository.countAdmins.mockResolvedValue(0);
    await weak.service.onModuleInit();
    expect(weak.repository.createAdmin).not.toHaveBeenCalled();
    expect(weak.scopedLogger.warn).toHaveBeenCalled();
  });
});
