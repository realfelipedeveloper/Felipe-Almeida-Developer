import { describe, expect, it } from 'vitest';
import { AdminApiError } from './admin-api';
import { shouldRedirectToAdminLogin } from './admin-session';

describe('validação da sessão administrativa', () => {
  it('redireciona para o login quando a autenticação é inválida', () => {
    expect(
      shouldRedirectToAdminLogin(
        new AdminApiError('Sessão administrativa inválida ou expirada.', 401),
      ),
    ).toBe(true);
  });

  it('não trata indisponibilidade da API como logout', () => {
    expect(
      shouldRedirectToAdminLogin(
        new AdminApiError('Serviço temporariamente indisponível.', 503),
      ),
    ).toBe(false);
  });

  it('não trata falha de rede como logout', () => {
    expect(
      shouldRedirectToAdminLogin(new TypeError('Failed to fetch')),
    ).toBe(false);
  });
});
