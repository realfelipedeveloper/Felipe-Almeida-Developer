import type { NextFunction, Request, Response } from 'express';

function asHttpOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAllowedOrigins(): string[] {
  const configured = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const candidates = [
    process.env.WEB_URL ?? 'http://localhost:3000',
    ...configured,
  ];

  return [...new Set(candidates.map(asHttpOrigin).filter((value): value is string => Boolean(value)))];
}

export function resolveBodyLimit(): string {
  const configured = (process.env.API_BODY_LIMIT ?? '64kb').trim().toLowerCase();
  return /^\d+(kb|mb)$/.test(configured) ? configured : '64kb';
}

export function shouldEnableSwagger(): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  );
}

function assertStrongSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): void {
  const value = process.env[name]?.trim();
  if (!value || value.length < 32 || value.startsWith('gere-com-')) {
    throw new Error(
      `${name} precisa ser configurado em produção com um segredo forte de pelo menos 32 caracteres.`,
    );
  }
}

export function validateProductionSecurityConfig(): void {
  if (process.env.NODE_ENV !== 'production') return;

  assertStrongSecret('JWT_ACCESS_SECRET');
  assertStrongSecret('JWT_REFRESH_SECRET');

  const webOrigin = asHttpOrigin(process.env.WEB_URL);
  if (!webOrigin || !webOrigin.startsWith('https://')) {
    throw new Error('WEB_URL precisa utilizar HTTPS em produção.');
  }

  if (
    process.env.METRICS_ENABLED !== 'false' &&
    !process.env.METRICS_TOKEN?.trim()
  ) {
    throw new Error(
      'METRICS_TOKEN é obrigatório em produção quando METRICS_ENABLED não estiver desativado.',
    );
  }
}

export function httpSecurityHeaders(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');

  if (request.path.startsWith('/api/admin')) {
    response.setHeader(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.setHeader('Pragma', 'no-cache');
  }

  if (!request.path.startsWith('/docs')) {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    );
  }

  if (process.env.NODE_ENV === 'production') {
    response.setHeader(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    );
  }

  next();
}
