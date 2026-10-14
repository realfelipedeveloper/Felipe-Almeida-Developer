import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminFetch } from './admin-api';

describe('cliente da API administrativa', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('compartilha uma única renovação entre requisições 401 concorrentes', async () => {
    vi.stubGlobal('document', {
      cookie: 'fad_admin_csrf=csrf-valido',
    });

    let meCalls = 0;
    let refreshCalls = 0;

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      if (url.endsWith('/api/admin/auth/refresh')) {
        refreshCalls += 1;

        await new Promise((resolve) => setTimeout(resolve, 20));

        return new Response(
          JSON.stringify({
            admin: {
              id: 'admin-1',
              email: 'admin@local.test',
              role: 'SUPER_ADMIN',
              sessionId: 'sessao-1',
              mustChangePassword: false,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      if (url.endsWith('/api/admin/auth/me')) {
        meCalls += 1;

        if (meCalls <= 2) {
          return new Response(
            JSON.stringify({
              message: 'Sessão administrativa inválida ou expirada.',
            }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        return new Response(
          JSON.stringify({
            admin: {
              id: 'admin-1',
              email: 'admin@local.test',
              role: 'SUPER_ADMIN',
              sessionId: 'sessao-1',
              mustChangePassword: false,
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }

      throw new Error(`URL não prevista no teste: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([adminFetch('/api/admin/auth/me'), adminFetch('/api/admin/auth/me')]);

    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(4);
  });

  it('deixa o navegador definir o boundary de multipart para FormData', async () => {
    vi.stubGlobal('document', { cookie: 'fad_admin_csrf=csrf-valido' });
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.has('Content-Type')).toBe(false);
      expect(headers.get('x-csrf-token')).toBe('csrf-valido');
      return new Response(JSON.stringify({ id: 'media-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const form = new FormData();
    form.append('file', new Blob(['file'], { type: 'image/png' }), 'file.png');
    await adminFetch('/api/admin/media', { method: 'POST', body: form });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
