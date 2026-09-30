import { AdminApiError } from './admin-api';

export function shouldRedirectToAdminLogin(cause: unknown): boolean {
  return cause instanceof AdminApiError && cause.status === 401;
}
