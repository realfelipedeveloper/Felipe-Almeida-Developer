import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { readDevelopmentAdminConfig } = require('../../apps/api/prisma/admin-credentials.cjs');

test('normaliza credencial administrativa válida de desenvolvimento', () => {
  assert.deepEqual(
    readDevelopmentAdminConfig({
      NODE_ENV: 'development',
      ADMIN_EMAIL: '  ADMIN@EXAMPLE.COM ',
      ADMIN_INITIAL_PASSWORD: 'senha-local-segura',
    }),
    { email: 'admin@example.com', password: 'senha-local-segura' },
  );
});

test('recusa sincronização administrativa fora de desenvolvimento', () => {
  for (const nodeEnv of ['production', 'staging', 'test']) {
    assert.throws(
      () =>
        readDevelopmentAdminConfig({
          NODE_ENV: nodeEnv,
          ADMIN_EMAIL: 'admin@example.com',
          ADMIN_INITIAL_PASSWORD: 'senha-local-segura',
        }),
      /NODE_ENV=development/i,
    );
  }
});

test('recusa placeholders e senha fora da política', () => {
  assert.throws(
    () =>
      readDevelopmentAdminConfig({
        NODE_ENV: 'development',
        ADMIN_EMAIL: 'TODO@seu-email.com',
        ADMIN_INITIAL_PASSWORD: 'troque-no-primeiro-login',
      }),
    /ADMIN_EMAIL/i,
  );

  assert.throws(
    () =>
      readDevelopmentAdminConfig({
        NODE_ENV: 'development',
        ADMIN_EMAIL: 'admin@example.com',
        ADMIN_INITIAL_PASSWORD: '123',
      }),
    /entre 4 e 200 caracteres/i,
  );
});
