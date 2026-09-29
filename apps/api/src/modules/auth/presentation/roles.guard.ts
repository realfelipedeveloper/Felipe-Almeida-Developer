import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AdminRoleValue } from '../application/auth.types';
import { ADMIN_ROLES_KEY } from './roles.decorator';
import type { AdminRequest } from './auth.request';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AdminRoleValue[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<AdminRequest>();
    if (!request.admin || !roles.includes(request.admin.role)) {
      throw new ForbiddenException('Permissão administrativa insuficiente.');
    }
    return true;
  }
}
