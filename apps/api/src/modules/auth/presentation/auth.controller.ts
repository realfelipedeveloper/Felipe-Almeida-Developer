import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthService } from '../application/auth.service';
import type { AuthenticatedAdmin } from '../application/auth.types';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminRoles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import {
  ADMIN_ACCESS_COOKIE,
  ADMIN_CSRF_COOKIE,
  ADMIN_REFRESH_COOKIE,
} from './auth.constants';
import type { AdminRequest } from './auth.request';
import { CsrfGuard } from './csrf.guard';
import { CurrentAdmin } from './current-admin.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface SessionResult {
  admin: AuthenticatedAdmin;
  accessToken: string;
  refreshToken: string;
  accessMaxAgeSeconds: number;
  refreshMaxAgeSeconds: number;
  csrfToken: string;
}

@ApiTags('administração - autenticação')
@Controller('admin/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Autentica um administrador e cria uma sessão segura' })
  async login(
    @Body() body: LoginDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(
      body.email,
      body.password,
      request.header('user-agent'),
      request.ip,
    );
    this.writeSessionCookies(response, result);
    return { admin: result.admin };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Solicita recuperação da senha administrativa sem revelar a existência da conta',
  })
  requestPasswordReset(
    @Body() body: ForgotPasswordDto,
    @Req() request: AdminRequest,
  ) {
    return this.auth.requestPasswordReset(body.email, request.ip);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Redefine a senha administrativa usando um token temporário de uso único',
  })
  resetPassword(@Body() body: ResetPasswordDto) {
    return this.auth.resetPassword(body.token, body.newPassword);
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Rotaciona access token e refresh token da sessão administrativa' })
  async refresh(
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) throw new UnauthorizedException('Refresh token ausente.');
    const result = await this.auth.refresh(refreshToken);
    this.writeSessionCookies(response, result);
    return { admin: result.admin };
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Retorna o administrador autenticado' })
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return { admin };
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(CsrfGuard)
  @ApiOperation({ summary: 'Encerra a sessão administrativa atual' })
  async logout(
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = request.cookies?.[ADMIN_REFRESH_COOKIE] as string | undefined;
    await this.auth.logout(refreshToken);
    this.clearSessionCookies(response);
  }

  @Post('logout-all')
  @HttpCode(204)
  @AdminRoles('SUPER_ADMIN')
  @UseGuards(AdminAuthGuard, CsrfGuard, RolesGuard)
  @ApiOperation({ summary: 'Revoga todas as sessões do administrador superadministrador' })
  async logoutAll(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.auth.logoutAll(admin);
    this.clearSessionCookies(response);
  }

  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AdminAuthGuard, CsrfGuard)
  @ApiOperation({ summary: 'Troca a senha do administrador e recria a sessão' })
  async changePassword(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Body() body: ChangePasswordDto,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.changePassword(
      admin,
      body.currentPassword,
      body.newPassword,
      request.header('user-agent'),
      request.ip,
    );
    this.writeSessionCookies(response, result);
    return { admin: result.admin };
  }

  private writeSessionCookies(response: Response, result: SessionResult): void {
    const secure = process.env.NODE_ENV === 'production';
    const common = { secure, sameSite: 'lax' as const, path: '/' };

    response.cookie(ADMIN_ACCESS_COOKIE, result.accessToken, {
      ...common,
      httpOnly: true,
      maxAge: result.accessMaxAgeSeconds * 1_000,
    });
    response.cookie(ADMIN_REFRESH_COOKIE, result.refreshToken, {
      ...common,
      httpOnly: true,
      maxAge: result.refreshMaxAgeSeconds * 1_000,
    });
    response.cookie(ADMIN_CSRF_COOKIE, result.csrfToken, {
      ...common,
      httpOnly: false,
      maxAge: result.refreshMaxAgeSeconds * 1_000,
    });
  }

  private clearSessionCookies(response: Response): void {
    const secure = process.env.NODE_ENV === 'production';
    const common = { secure, sameSite: 'lax' as const, path: '/' };
    response.clearCookie(ADMIN_ACCESS_COOKIE, { ...common, httpOnly: true });
    response.clearCookie(ADMIN_REFRESH_COOKIE, { ...common, httpOnly: true });
    response.clearCookie(ADMIN_CSRF_COOKIE, { ...common, httpOnly: false });
  }
}
