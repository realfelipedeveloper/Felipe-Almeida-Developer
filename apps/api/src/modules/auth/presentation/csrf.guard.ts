import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { ADMIN_CSRF_COOKIE, ADMIN_CSRF_HEADER } from './auth.constants';
import type { AdminRequest } from './auth.request';

const INVALID_SECURITY_SESSION_MESSAGE =
  'Não foi possível validar sua sessão de segurança. Entre novamente para continuar.';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    const cookieValue = request.cookies?.[ADMIN_CSRF_COOKIE] as string | undefined;
    const headerValue = request.header(ADMIN_CSRF_HEADER);

    if (!cookieValue || !headerValue) {
      throw new ForbiddenException(INVALID_SECURITY_SESSION_MESSAGE);
    }

    const left = Buffer.from(cookieValue);
    const right = Buffer.from(headerValue);

    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new ForbiddenException(INVALID_SECURITY_SESSION_MESSAGE);
    }

    return true;
  }
}
