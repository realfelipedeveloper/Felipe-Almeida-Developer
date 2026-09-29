import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('gera hash Argon2id e valida a senha correta', async () => {
    const hash = await service.hash('SenhaMuitoForte#2026');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(service.verify(hash, 'SenhaMuitoForte#2026')).resolves.toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hash = await service.hash('SenhaMuitoForte#2026');
    await expect(service.verify(hash, 'senha-incorreta')).resolves.toBe(false);
  });
});
