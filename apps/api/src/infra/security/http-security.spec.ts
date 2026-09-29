import {
  httpSecurityHeaders,
  resolveAllowedOrigins,
  resolveBodyLimit,
  shouldEnableSwagger,
  validateProductionSecurityConfig,
} from './http-security';

describe('hardening HTTP da API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('normaliza e remove duplicidades da allowlist de CORS', () => {
    process.env.WEB_URL = 'http://localhost:3000';
    process.env.CORS_ALLOWED_ORIGINS =
      'https://portfolio.example.com, https://portfolio.example.com/path, javascript:alert(1)';

    expect(resolveAllowedOrigins()).toEqual([
      'http://localhost:3000',
      'https://portfolio.example.com',
    ]);
  });

  it('usa limite seguro quando API_BODY_LIMIT é inválido', () => {
    process.env.API_BODY_LIMIT = 'sem-limite';
    expect(resolveBodyLimit()).toBe('64kb');

    process.env.API_BODY_LIMIT = '128KB';
    expect(resolveBodyLimit()).toBe('128kb');
  });

  it('desabilita Swagger por padrão em produção', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SWAGGER_ENABLED;
    expect(shouldEnableSwagger()).toBe(false);

    process.env.SWAGGER_ENABLED = 'true';
    expect(shouldEnableSwagger()).toBe(true);
  });

  it('recusa produção sem segredos fortes', () => {
    process.env.NODE_ENV = 'production';
    process.env.WEB_URL = 'https://portfolio.example.com';
    process.env.METRICS_ENABLED = 'false';
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;

    expect(() => validateProductionSecurityConfig()).toThrow(
      'JWT_ACCESS_SECRET',
    );
  });

  it('aceita configuração mínima segura de produção', () => {
    process.env.NODE_ENV = 'production';
    process.env.WEB_URL = 'https://portfolio.example.com';
    process.env.JWT_ACCESS_SECRET = 'a'.repeat(64);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(64);
    process.env.METRICS_ENABLED = 'true';
    process.env.METRICS_TOKEN = 'token-de-metricas-forte';

    expect(() => validateProductionSecurityConfig()).not.toThrow();
  });

  it('aplica headers de segurança e impede cache no admin', () => {
    process.env.NODE_ENV = 'test';
    const setHeader = jest.fn();
    const next = jest.fn();

    httpSecurityHeaders(
      { path: '/api/admin/auth/me' } as never,
      { setHeader } as never,
      next,
    );

    expect(setHeader).toHaveBeenCalledWith(
      'X-Content-Type-Options',
      'nosniff',
    );
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      expect.stringContaining('no-store'),
    );
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining("default-src 'none'"),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
