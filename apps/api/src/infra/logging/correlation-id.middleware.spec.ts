import { resolveCorrelationId } from './correlation-id.middleware';

describe('resolveCorrelationId', () => {
  it('preserva um identificador seguro recebido do cliente', () => {
    expect(resolveCorrelationId('req-2026_09.29:abc')).toBe(
      'req-2026_09.29:abc',
    );
  });

  it('substitui conteúdo fora da allowlist por UUID', () => {
    const result = resolveCorrelationId('valor com espaços <script>');
    expect(result).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('substitui valores excessivamente longos', () => {
    expect(resolveCorrelationId('a'.repeat(101))).not.toBe('a'.repeat(101));
  });
});
