import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type {
  AccessTokenPayload,
  AdminAccount,
  IssuedTokens,
  RefreshTokenPayload,
} from './auth.types';

function durationToSeconds(value: string | undefined, fallbackSeconds: number): number {
  if (!value) return fallbackSeconds;
  const match = value.trim().match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return fallbackSeconds;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === 'd' ? 86_400 : unit === 'h' ? 3_600 : unit === 'm' ? 60 : 1;
  return amount * multiplier;
}

function getSecret(name: 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'): string {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith('gere-com-') || value.length < 32) {
    throw new Error(`${name} precisa ser configurado com um segredo forte de pelo menos 32 caracteres.`);
  }
  return value;
}

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  async issue(admin: AdminAccount, sessionId: string): Promise<IssuedTokens> {
    const accessMaxAgeSeconds = durationToSeconds(process.env.JWT_ACCESS_TTL, 15 * 60);
    const refreshMaxAgeSeconds = durationToSeconds(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60);

    const accessPayload: AccessTokenPayload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      sessionId,
      mustChangePassword: admin.mustChangePassword,
      type: 'access',
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: admin.id,
      sessionId,
      type: 'refresh',
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: getSecret('JWT_ACCESS_SECRET'),
        expiresIn: accessMaxAgeSeconds,
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: getSecret('JWT_REFRESH_SECRET'),
        expiresIn: refreshMaxAgeSeconds,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      accessMaxAgeSeconds,
      refreshMaxAgeSeconds,
      refreshExpiresAt: new Date(Date.now() + refreshMaxAgeSeconds * 1_000),
    };
  }

  async verifyAccess(token: string): Promise<AccessTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: getSecret('JWT_ACCESS_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('Tipo de token inválido.');
      return payload;
    } catch {
      throw new UnauthorizedException('Sessão administrativa inválida ou expirada.');
    }
  }

  async verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: getSecret('JWT_REFRESH_SECRET'),
      });
      if (payload.type !== 'refresh') throw new Error('Tipo de token inválido.');
      return payload;
    } catch {
      throw new UnauthorizedException('Sessão administrativa inválida ou expirada.');
    }
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
