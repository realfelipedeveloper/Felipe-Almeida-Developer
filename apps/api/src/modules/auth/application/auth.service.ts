import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import { AppLogger } from '../../../infra/logging/app-logger.service';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { RedisService } from '../../../infra/redis/redis.service';
import {
  ADMIN_AUTH_REPOSITORY,
  type AdminAccount,
  type AdminAuthRepository,
  type AuthenticatedAdmin,
} from './auth.types';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

const LOGIN_WINDOW_SECONDS = 15 * 60;
const LOGIN_MAX_ATTEMPTS = 5;

const PASSWORD_RESET_WINDOW_SECONDS = 15 * 60;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_TOKEN_TTL_SECONDS = 30 * 60;

const PASSWORD_RESET_RESPONSE =
  'Se existir uma conta associada a este e-mail, enviaremos as instruções de recuperação.';

const INVALID_PASSWORD_RESET_TOKEN =
  'O link de recuperação é inválido ou expirou. Solicite uma nova recuperação de senha.';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @Inject(ADMIN_AUTH_REPOSITORY)
    private readonly repository: AdminAuthRepository,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapFirstAdmin();
  }

  async login(
    emailValue: string,
    password: string,
    userAgent?: string,
    ip?: string,
  ) {
    const email = emailValue.trim().toLowerCase();
    await this.assertLoginAllowed(email, ip);

    const admin =
      await this.repository.findAdminByEmail(email);
    const validPassword = admin
      ? await this.passwords.verify(
          admin.passwordHash,
          password,
        )
      : false;

    if (!admin || !admin.active || !validPassword) {
      await this.registerFailedLogin(email, ip);
      this.logger
        .child('seguranca')
        .warn(
          { emailHash: this.hashIdentifier(email) },
          'Falha de login administrativo',
        );
      throw new UnauthorizedException(
        'Credenciais inválidas.',
      );
    }

    await this.clearLoginAttempts(email, ip);
    const result = await this.createSession(
      admin,
      userAgent,
      ip,
    );
    await this.repository.updateSuccessfulLogin(
      admin.id,
      new Date(),
    );
    await this.writeAudit(
      admin.id,
      'AUTH_LOGIN_SUCCESS',
      'AdminUser',
      admin.id,
    );

    return result;
  }

  async requestPasswordReset(
    emailValue: string,
    ip?: string,
  ): Promise<{ message: string }> {
    const email = emailValue.trim().toLowerCase();

    await this.assertPasswordResetAllowed(email, ip);

    const admin =
      await this.repository.findAdminByEmail(email);

    if (!admin?.active) {
      this.logger
        .child('seguranca')
        .info(
          { emailHash: this.hashIdentifier(email) },
          'Recuperação de senha solicitada para conta inexistente ou inativa',
        );

      return { message: PASSWORD_RESET_RESPONSE };
    }

    const tokenId = randomUUID();
    const token = this.derivePasswordResetToken(
      tokenId,
      admin.id,
    );
    const tokenHash = this.hashValue(token);
    const resetKey =
      this.passwordResetTokenKey(tokenHash);
    const activeKey =
      this.passwordResetActiveKey(admin.id);

    try {
      const previousHash =
        await this.redis.connection.get(activeKey);

      const transaction = this.redis.connection.multi();

      if (previousHash) {
        transaction.del(
          this.passwordResetTokenKey(previousHash),
        );
      }

      transaction.set(
        resetKey,
        admin.id,
        'EX',
        PASSWORD_RESET_TOKEN_TTL_SECONDS,
      );
      transaction.set(
        activeKey,
        tokenHash,
        'EX',
        PASSWORD_RESET_TOKEN_TTL_SECONDS,
      );

      await transaction.exec();

      await this.prisma.outboxEvent.create({
        data: {
          eventName: 'admin.password-reset.requested',
          aggregateType: 'AdminUser',
          aggregateId: admin.id,
          correlationId: randomUUID(),
          payload: {
            adminUserId: admin.id,
            tokenId,
            email: admin.email,
          } satisfies Prisma.JsonObject,
        },
      });

      await this.prisma.auditLog
        .create({
          data: {
            actorAdminId: null,
            action: 'AUTH_PASSWORD_RESET_REQUESTED',
            resourceType: 'AdminUser',
            resourceId: admin.id,
            ipHash: ip
              ? this.hashIdentifier(ip)
              : null,
          },
        })
        .catch(() => undefined);

      this.logger
        .child('seguranca')
        .info(
          { adminId: admin.id },
          'Recuperação de senha administrativa solicitada',
        );
    } catch (error) {
      await this.redis.connection
        .del(resetKey, activeKey)
        .catch(() => undefined);

      this.logger
        .child('seguranca')
        .error(
          {
            adminId: admin.id,
            erro:
              error instanceof Error
                ? error.message
                : String(error),
          },
          'Falha ao preparar recuperação de senha administrativa',
        );
    }

    return { message: PASSWORD_RESET_RESPONSE };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const tokenHash = this.hashValue(token);
    const resetKey =
      this.passwordResetTokenKey(tokenHash);

    let adminUserId: string | null = null;

    try {
      adminUserId =
        await this.redis.connection.get(resetKey);
    } catch {
      throw new BadRequestException(
        INVALID_PASSWORD_RESET_TOKEN,
      );
    }

    if (!adminUserId) {
      throw new BadRequestException(
        INVALID_PASSWORD_RESET_TOKEN,
      );
    }

    const account =
      await this.repository.findAdminById(adminUserId);

    if (!account?.active) {
      await this.redis.connection
        .del(resetKey)
        .catch(() => undefined);

      throw new BadRequestException(
        INVALID_PASSWORD_RESET_TOKEN,
      );
    }

    const samePassword =
      await this.passwords.verify(
        account.passwordHash,
        newPassword,
      );

    if (samePassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const consumed =
      await this.redis.connection.eval(
        `
          if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
          end
          return 0
        `,
        1,
        resetKey,
        account.id,
      );

    if (Number(consumed) !== 1) {
      throw new BadRequestException(
        INVALID_PASSWORD_RESET_TOKEN,
      );
    }

    const passwordHash =
      await this.passwords.hash(newPassword);
    const now = new Date();

    await this.repository.updatePassword({
      adminUserId: account.id,
      passwordHash,
      mustChangePassword: false,
    });

    await this.repository.revokeAllSessions(
      account.id,
      now,
    );

    await this.redis.connection
      .del(this.passwordResetActiveKey(account.id))
      .catch(() => undefined);

    await this.prisma.auditLog
      .create({
        data: {
          actorAdminId: null,
          action: 'AUTH_PASSWORD_RESET_COMPLETED',
          resourceType: 'AdminUser',
          resourceId: account.id,
        },
      })
      .catch(() => undefined);

    this.logger
      .child('seguranca')
      .warn(
        { adminId: account.id },
        'Senha administrativa redefinida por recuperação',
      );

    return {
      message:
        'Senha redefinida com sucesso. Entre novamente com a nova senha.',
    };
  }

  async refresh(refreshToken: string) {
    const payload =
      await this.tokens.verifyRefresh(refreshToken);
    const session =
      await this.repository.findActiveSessionById(
        payload.sessionId,
      );

    if (
      !session ||
      session.adminUserId !== payload.sub
    ) {
      throw new UnauthorizedException(
        'Sessão administrativa inválida ou expirada.',
      );
    }

    if (
      !this.sameHash(
        session.refreshTokenHash,
        this.tokens.hashToken(refreshToken),
      )
    ) {
      await this.repository.revokeSession(
        session.id,
        new Date(),
      );
      throw new UnauthorizedException(
        'Sessão administrativa inválida ou expirada.',
      );
    }

    const admin =
      await this.repository.findAdminById(payload.sub);

    if (!admin?.active) {
      await this.repository.revokeSession(
        session.id,
        new Date(),
      );
      throw new UnauthorizedException(
        'Conta administrativa indisponível.',
      );
    }

    const issued = await this.tokens.issue(
      admin,
      session.id,
    );

    await this.repository.rotateSession({
      sessionId: session.id,
      refreshTokenHash: this.tokens.hashToken(
        issued.refreshToken,
      ),
      expiresAt: issued.refreshExpiresAt,
      lastUsedAt: new Date(),
    });

    return {
      admin: this.toAuthenticated(
        admin,
        session.id,
      ),
      ...issued,
      csrfToken: this.generateCsrfToken(),
    };
  }

  async logout(
    refreshToken: string | undefined,
  ): Promise<void> {
    if (!refreshToken) return;

    try {
      const payload =
        await this.tokens.verifyRefresh(refreshToken);

      await this.repository.revokeSession(
        payload.sessionId,
        new Date(),
      );

      await this.writeAudit(
        payload.sub,
        'AUTH_LOGOUT',
        'AdminSession',
        payload.sessionId,
      );
    } catch {
      // Logout deve ser idempotente mesmo para token expirado/inválido.
    }
  }

  async logoutAll(
    admin: AuthenticatedAdmin,
  ): Promise<void> {
    await this.repository.revokeAllSessions(
      admin.id,
      new Date(),
    );

    await this.writeAudit(
      admin.id,
      'AUTH_LOGOUT_ALL',
      'AdminUser',
      admin.id,
    );
  }

  async changePassword(
    admin: AuthenticatedAdmin,
    currentPassword: string,
    newPassword: string,
    userAgent?: string,
    ip?: string,
  ) {
    const account =
      await this.repository.findAdminById(admin.id);

    if (!account?.active) {
      throw new UnauthorizedException(
        'Conta administrativa indisponível.',
      );
    }

    const validCurrent =
      await this.passwords.verify(
        account.passwordHash,
        currentPassword,
      );

    if (!validCurrent) {
      throw new BadRequestException(
        'Senha atual incorreta.',
      );
    }

    const samePassword =
      await this.passwords.verify(
        account.passwordHash,
        newPassword,
      );

    if (samePassword) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const passwordHash =
      await this.passwords.hash(newPassword);

    await this.repository.updatePassword({
      adminUserId: account.id,
      passwordHash,
      mustChangePassword: false,
    });

    await this.repository.revokeAllSessions(
      account.id,
      new Date(),
    );

    const updated: AdminAccount = {
      ...account,
      passwordHash,
      mustChangePassword: false,
    };

    const result = await this.createSession(
      updated,
      userAgent,
      ip,
    );

    await this.writeAudit(
      account.id,
      'AUTH_PASSWORD_CHANGED',
      'AdminUser',
      account.id,
    );

    return result;
  }

  async resolveAccessToken(
    accessToken: string,
  ): Promise<AuthenticatedAdmin> {
    const payload =
      await this.tokens.verifyAccess(accessToken);

    const [session, account] =
      await Promise.all([
        this.repository.findActiveSessionById(
          payload.sessionId,
        ),
        this.repository.findAdminById(payload.sub),
      ]);

    if (
      !session ||
      session.adminUserId !== payload.sub ||
      !account?.active
    ) {
      throw new UnauthorizedException(
        'Sessão administrativa inválida ou expirada.',
      );
    }

    return this.toAuthenticated(
      account,
      session.id,
    );
  }

  private async createSession(
    admin: AdminAccount,
    userAgent?: string,
    ip?: string,
  ) {
    const sessionId = randomUUID();
    const issued = await this.tokens.issue(
      admin,
      sessionId,
    );

    await this.repository.createSession({
      id: sessionId,
      adminUserId: admin.id,
      refreshTokenHash: this.tokens.hashToken(
        issued.refreshToken,
      ),
      userAgent:
        userAgent?.slice(0, 500) ?? null,
      ipHash: ip
        ? this.hashIdentifier(ip)
        : null,
      expiresAt: issued.refreshExpiresAt,
    });

    return {
      admin: this.toAuthenticated(
        admin,
        sessionId,
      ),
      ...issued,
      csrfToken: this.generateCsrfToken(),
    };
  }

  private toAuthenticated(
    admin: AdminAccount,
    sessionId: string,
  ): AuthenticatedAdmin {
    return {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      sessionId,
      mustChangePassword:
        admin.mustChangePassword,
    };
  }

  private derivePasswordResetToken(
    tokenId: string,
    adminUserId: string,
  ): string {
    const secret =
      process.env.JWT_REFRESH_SECRET?.trim();

    if (
      !secret ||
      secret.length < 32 ||
      secret.startsWith('gere-')
    ) {
      throw new Error(
        'JWT_REFRESH_SECRET precisa ter pelo menos 32 caracteres para recuperação de senha.',
      );
    }

    const signature = createHmac(
      'sha256',
      secret,
    )
      .update(
        `admin-password-reset:${tokenId}:${adminUserId}`,
      )
      .digest('base64url');

    return `${tokenId}.${signature}`;
  }

  private passwordResetTokenKey(
    tokenHash: string,
  ): string {
    return `auth:admin:recuperacao:token:${tokenHash}`;
  }

  private passwordResetActiveKey(
    adminUserId: string,
  ): string {
    return `auth:admin:recuperacao:ativo:${adminUserId}`;
  }

  private generateCsrfToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private sameHash(
    left: string,
    right: string,
  ): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);

    return (
      a.length === b.length &&
      timingSafeEqual(a, b)
    );
  }

  private hashIdentifier(value: string): string {
    const key =
      process.env.JWT_ACCESS_SECRET ??
      'desenvolvimento-local-sem-segredo';

    return createHmac('sha256', key)
      .update(value)
      .digest('hex');
  }

  private hashValue(value: string): string {
    return createHash('sha256')
      .update(value)
      .digest('hex');
  }

  private attemptKey(
    email: string,
    ip?: string,
  ): string {
    return `auth:admin:tentativas:${this.hashIdentifier(
      `${email}:${ip ?? 'sem-ip'}`,
    )}`;
  }

  private passwordResetAttemptKey(
    email: string,
    ip?: string,
  ): string {
    return `auth:admin:recuperacao:tentativas:${this.hashIdentifier(
      `${email}:${ip ?? 'sem-ip'}`,
    )}`;
  }

  private async assertLoginAllowed(
    email: string,
    ip?: string,
  ): Promise<void> {
    try {
      const value =
        await this.redis.connection.get(
          this.attemptKey(email, ip),
        );

      if (
        Number(value ?? 0) >=
        LOGIN_MAX_ATTEMPTS
      ) {
        throw new HttpException(
          'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger
        .child('seguranca')
        .warn(
          'Rate limit de login indisponível; autenticação seguirá com os demais controles.',
        );
    }
  }

  private async assertPasswordResetAllowed(
    email: string,
    ip?: string,
  ): Promise<void> {
    try {
      const key =
        this.passwordResetAttemptKey(
          email,
          ip,
        );

      const count =
        await this.redis.connection.incr(key);

      if (count === 1) {
        await this.redis.connection.expire(
          key,
          PASSWORD_RESET_WINDOW_SECONDS,
        );
      }

      if (
        count >
        PASSWORD_RESET_MAX_ATTEMPTS
      ) {
        throw new HttpException(
          'Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger
        .child('seguranca')
        .warn(
          'Rate limit de recuperação de senha indisponível; a solicitação seguirá sem revelar a existência da conta.',
        );
    }
  }

  private async registerFailedLogin(
    email: string,
    ip?: string,
  ): Promise<void> {
    try {
      const key = this.attemptKey(email, ip);
      const count =
        await this.redis.connection.incr(key);

      if (count === 1) {
        await this.redis.connection.expire(
          key,
          LOGIN_WINDOW_SECONDS,
        );
      }
    } catch {
      // Redis indisponível não deve impedir a autenticação; log já existe no serviço Redis.
    }
  }

  private async clearLoginAttempts(
    email: string,
    ip?: string,
  ): Promise<void> {
    try {
      await this.redis.connection.del(
        this.attemptKey(email, ip),
      );
    } catch {
      // Sem efeito funcional caso Redis esteja indisponível.
    }
  }

  private async writeAudit(
    actorAdminId: string,
    action: string,
    resourceType: string,
    resourceId?: string,
  ): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          actorAdminId,
          action,
          resourceType,
          resourceId:
            resourceId ?? null,
        },
      })
      .catch(() => undefined);
  }

  private async bootstrapFirstAdmin(): Promise<void> {
    const email =
      process.env.ADMIN_EMAIL
        ?.trim()
        .toLowerCase();
    const password =
      process.env.ADMIN_INITIAL_PASSWORD;

    if (
      !email ||
      email.startsWith('todo@') ||
      !password ||
      password === 'troque-no-primeiro-login'
    ) {
      return;
    }

    if (await this.repository.countAdmins()) {
      return;
    }

    if (password.length < 4) {
      this.logger
        .child('seguranca')
        .warn(
          'ADMIN_INITIAL_PASSWORD ignorada: utilize pelo menos 4 caracteres.',
        );
      return;
    }

    const passwordHash =
      await this.passwords.hash(password);

    const admin =
      await this.repository.createAdmin({
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
      });

    this.logger
      .child('seguranca')
      .warn(
        { adminId: admin.id },
        'Primeiro SUPER_ADMIN criado a partir das variáveis de ambiente. Troque a senha no primeiro login.',
      );
  }
}
