import { Injectable } from '@nestjs/common';
import { AdminRole } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type {
  AdminAccount,
  AdminAuthRepository,
  AdminSessionData,
  CreateAdminInput,
  CreateAdminSessionInput,
  RotateAdminSessionInput,
  UpdateAdminPasswordInput,
} from '../application/auth.types';

@Injectable()
export class PrismaAdminAuthRepository implements AdminAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  countAdmins(): Promise<number> {
    return this.prisma.adminUser.count();
  }

  async createAdmin(input: CreateAdminInput): Promise<AdminAccount> {
    const row = await this.prisma.adminUser.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role === 'SUPER_ADMIN' ? AdminRole.SUPER_ADMIN : AdminRole.ADMIN,
        active: true,
        mustChangePassword: true,
      },
    });
    return this.toAdmin(row);
  }

  async findAdminByEmail(email: string): Promise<AdminAccount | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { email } });
    return row ? this.toAdmin(row) : null;
  }

  async findAdminById(id: string): Promise<AdminAccount | null> {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    return row ? this.toAdmin(row) : null;
  }

  async createSession(input: CreateAdminSessionInput): Promise<AdminSessionData> {
    const row = await this.prisma.adminSession.create({
      data: {
        id: input.id,
        adminUserId: input.adminUserId,
        refreshTokenHash: input.refreshTokenHash,
        userAgent: input.userAgent ?? null,
        ipHash: input.ipHash ?? null,
        expiresAt: input.expiresAt,
      },
    });
    return this.toSession(row);
  }

  async findActiveSessionById(sessionId: string): Promise<AdminSessionData | null> {
    const row = await this.prisma.adminSession.findFirst({
      where: {
        id: sessionId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    return row ? this.toSession(row) : null;
  }

  async rotateSession(input: RotateAdminSessionInput): Promise<void> {
    await this.prisma.adminSession.update({
      where: { id: input.sessionId },
      data: {
        refreshTokenHash: input.refreshTokenHash,
        expiresAt: input.expiresAt,
        lastUsedAt: input.lastUsedAt,
      },
    });
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async revokeAllSessions(adminUserId: string, revokedAt: Date): Promise<void> {
    await this.prisma.adminSession.updateMany({
      where: { adminUserId, revokedAt: null },
      data: { revokedAt },
    });
  }

  async updateSuccessfulLogin(adminUserId: string, lastLoginAt: Date): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: adminUserId },
      data: { lastLoginAt },
    });
  }

  async updatePassword(input: UpdateAdminPasswordInput): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: input.adminUserId },
      data: {
        passwordHash: input.passwordHash,
        mustChangePassword: input.mustChangePassword,
      },
    });
  }

  private toAdmin(row: {
    id: string;
    email: string;
    passwordHash: string;
    role: AdminRole;
    active: boolean;
    mustChangePassword: boolean;
    lastLoginAt: Date | null;
  }): AdminAccount {
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      active: row.active,
      mustChangePassword: row.mustChangePassword,
      lastLoginAt: row.lastLoginAt,
    };
  }

  private toSession(row: {
    id: string;
    adminUserId: string;
    refreshTokenHash: string;
    userAgent: string | null;
    ipHash: string | null;
    expiresAt: Date;
    lastUsedAt: Date | null;
    revokedAt: Date | null;
    createdAt: Date;
  }): AdminSessionData {
    return { ...row };
  }
}
