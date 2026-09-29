import { describe, expect, it } from 'vitest';
import { getWebSecurityHeaders } from './http-security';

describe('headers defensivos do Web', () => {
  it('protege contra framing e MIME sniffing', () => {
    const headers = getWebSecurityHeaders('test');

    expect(headers).toContainEqual({
      key: 'X-Frame-Options',
      value: 'DENY',
    });
    expect(headers).toContainEqual({
      key: 'X-Content-Type-Options',
      value: 'nosniff',
    });
  });

  it('adiciona HSTS somente em produção', () => {
    expect(
      getWebSecurityHeaders('development').some(
        (header) => header.key === 'Strict-Transport-Security',
      ),
    ).toBe(false);

    expect(
      getWebSecurityHeaders('production').some(
        (header) => header.key === 'Strict-Transport-Security',
      ),
    ).toBe(true);
  });
});
