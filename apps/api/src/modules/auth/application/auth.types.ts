export const ADMIN_AUTH_REPOSITORY = Symbol('ADMIN_AUTH_REPOSITORY');

export type AdminRoleValue = 'ADMIN' | 'SUPER_ADMIN';

export interface AdminAccount {
  id: string;
  email: string;
  passwordHash: string;
  role: AdminRoleValue;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: Date | null;
}

export interface AdminSessionData {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipHash: string | null;
  expiresAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateAdminInput {
  email: string;
  passwordHash: string;
  role: AdminRoleValue;
}

export interface CreateAdminSessionInput {
  id: string;
  adminUserId: string;
  refreshTokenHash: string;
  userAgent?: string | null;
  ipHash?: string | null;
  expiresAt: Date;
}

export interface RotateAdminSessionInput {
  sessionId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  lastUsedAt: Date;
}

export interface UpdateAdminPasswordInput {
  adminUserId: string;
  passwordHash: string;
  mustChangePassword: boolean;
}

export interface AdminAuthRepository {
  countAdmins(): Promise<number>;
  createAdmin(input: CreateAdminInput): Promise<AdminAccount>;
  findAdminByEmail(email: string): Promise<AdminAccount | null>;
  findAdminById(id: string): Promise<AdminAccount | null>;
  createSession(input: CreateAdminSessionInput): Promise<AdminSessionData>;
  findActiveSessionById(sessionId: string): Promise<AdminSessionData | null>;
  rotateSession(input: RotateAdminSessionInput): Promise<void>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  revokeAllSessions(adminUserId: string, revokedAt: Date): Promise<void>;
  updateSuccessfulLogin(adminUserId: string, lastLoginAt: Date): Promise<void>;
  updatePassword(input: UpdateAdminPasswordInput): Promise<void>;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: AdminRoleValue;
  sessionId: string;
  mustChangePassword: boolean;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  role: AdminRoleValue;
  sessionId: string;
  mustChangePassword: boolean;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
  refreshExpiresAt: Date;
}
