import { JwtService } from '@nestjs/jwt';
import { TokenService } from './token.service';

describe('TokenService', () => {
  const originalAccess = process.env.JWT_ACCESS_SECRET;
  const originalRefresh = process.env.JWT_REFRESH_SECRET;
  const service = new TokenService(new JwtService());

  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
  });

  afterAll(() => {
    process.env.JWT_ACCESS_SECRET = originalAccess;
    process.env.JWT_REFRESH_SECRET = originalRefresh;
  });

  it('emite e valida access e refresh tokens com tipos distintos', async () => {
    const issued = await service.issue({
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
      passwordHash: 'hash',
      role: 'SUPER_ADMIN',
      active: true,
      mustChangePassword: false,
      lastLoginAt: null,
    }, '22222222-2222-4222-8222-222222222222');

    const access = await service.verifyAccess(issued.accessToken);
    const refresh = await service.verifyRefresh(issued.refreshToken);

    expect(access.type).toBe('access');
    expect(access.role).toBe('SUPER_ADMIN');
    expect(refresh.type).toBe('refresh');
    expect(refresh.sessionId).toBe('22222222-2222-4222-8222-222222222222');
  });

  it('gera hash determinístico para refresh token', () => {
    expect(service.hashToken('abc')).toBe(service.hashToken('abc'));
    expect(service.hashToken('abc')).not.toBe(service.hashToken('xyz'));
  });
});
