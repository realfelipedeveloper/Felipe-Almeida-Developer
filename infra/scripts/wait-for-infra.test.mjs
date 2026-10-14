import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForServices } from './wait-for-infra.mjs';

const services = [
  { name: 'PostgreSQL', host: 'localhost', port: 5432 },
  { name: 'RabbitMQ', host: 'localhost', port: 5672 },
];

test('encerra imediatamente quando todos os serviços estão disponíveis', async () => {
  const attempts = [];
  const result = await waitForServices(services, {
    probe: async (service) => {
      attempts.push(service.name);
      return true;
    },
    sleep: async () => undefined,
  });

  assert.deepEqual(result, services);
  assert.deepEqual(attempts, ['PostgreSQL', 'RabbitMQ']);
});

test('aguarda dependência em inicialização e tenta novamente', async () => {
  let rabbitAttempts = 0;
  let now = 0;
  const result = await waitForServices(services, {
    probe: async (service) => {
      if (service.name === 'PostgreSQL') return true;
      rabbitAttempts += 1;
      return rabbitAttempts >= 3;
    },
    now: () => now,
    sleep: async (delayMs) => {
      now += delayMs;
    },
    intervalMs: 100,
    timeoutMs: 1_000,
  });

  assert.equal(rabbitAttempts, 3);
  assert.equal(result.length, 2);
});

test('falha com mensagem acionável ao exceder o tempo limite', async () => {
  let now = 0;

  await assert.rejects(
    waitForServices(services, {
      probe: async () => false,
      now: () => now,
      sleep: async (delayMs) => {
        now += delayMs;
      },
      intervalMs: 100,
      timeoutMs: 200,
    }),
    /PostgreSQL.*RabbitMQ.*pnpm infra:up/s,
  );
});
