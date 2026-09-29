const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export interface AdminIdentity {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  sessionId: string;
  mustChangePassword: boolean;
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function cookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split('; ').find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : null;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
  if (!response.ok) {
    const raw = body?.message;
    const message = Array.isArray(raw) ? raw.join(' ') : raw ?? 'Falha ao comunicar com a API administrativa.';
    throw new AdminApiError(message, response.status);
  }
  return body as T;
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = cookieValue('fad_admin_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
    cache: 'no-store',
  });
}

async function tryRefresh(): Promise<boolean> {
  const csrf = cookieValue('fad_admin_csrf');
  if (!csrf) return false;
  const response = await fetch(`${API_BASE_URL}/api/admin/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'x-csrf-token': csrf,
    },
  });
  return response.ok;
}

export async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await request(path, init);
  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    if (await tryRefresh()) response = await request(path, init);
  }
  return parseResponse<T>(response);
}
