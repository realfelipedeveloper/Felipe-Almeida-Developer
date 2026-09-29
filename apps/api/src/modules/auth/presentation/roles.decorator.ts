import { SetMetadata } from '@nestjs/common';
import type { AdminRoleValue } from '../application/auth.types';

export const ADMIN_ROLES_KEY = 'adminRoles';
export const AdminRoles = (...roles: AdminRoleValue[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
