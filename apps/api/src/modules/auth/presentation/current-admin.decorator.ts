import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AdminRequest } from './auth.request';

export const CurrentAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<AdminRequest>();
  return request.admin;
});
