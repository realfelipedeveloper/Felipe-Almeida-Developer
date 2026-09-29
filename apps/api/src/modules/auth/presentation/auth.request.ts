import type { Request } from 'express';
import type { AuthenticatedAdmin } from '../application/auth.types';

export interface AdminRequest extends Request {
  admin?: AuthenticatedAdmin;
  correlationId?: string;
}
