import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../application/auth.service';
import { ADMIN_ACCESS_COOKIE } from './auth.constants';
import type { AdminRequest } from './auth.request';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const token = request.cookies?.[ADMIN_ACCESS_COOKIE] as string | undefined;
    if (!token) throw new UnauthorizedException('Autenticação administrativa necessária.');
    request.admin = await this.auth.resolveAccessToken(token);
    return true;
  }
}
