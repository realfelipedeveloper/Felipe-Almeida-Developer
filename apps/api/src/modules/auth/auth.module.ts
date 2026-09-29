import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ADMIN_AUTH_REPOSITORY } from './application/auth.types';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { TokenService } from './application/token.service';
import { PrismaAdminAuthRepository } from './infrastructure/prisma-admin-auth.repository';
import { AdminAuthGuard } from './presentation/admin-auth.guard';
import { AuthController } from './presentation/auth.controller';
import { CsrfGuard } from './presentation/csrf.guard';
import { PasswordReadyGuard } from './presentation/password-ready.guard';
import { RolesGuard } from './presentation/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AdminAuthGuard,
    CsrfGuard,
    PasswordReadyGuard,
    RolesGuard,
    {
      provide: ADMIN_AUTH_REPOSITORY,
      useClass: PrismaAdminAuthRepository,
    },
  ],
  exports: [AuthService, AdminAuthGuard, CsrfGuard, PasswordReadyGuard, RolesGuard],
})
export class AuthModule {}
