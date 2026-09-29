import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AdminRequest } from './auth.request';

@Injectable()
export class PasswordReadyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (request.admin?.mustChangePassword) {
      throw new ForbiddenException('Troque a senha inicial antes de administrar o conteúdo.');
    }
    return true;
  }
}
