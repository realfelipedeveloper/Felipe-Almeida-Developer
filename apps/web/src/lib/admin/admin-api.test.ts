import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
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

    await Promise.all([
      adminFetch('/api/admin/auth/me'),
      adminFetch('/api/admin/auth/me'),
    ]);

    expect(refreshCalls).toBe(1);
    expect(meCalls).toBe(4);
  });
});
