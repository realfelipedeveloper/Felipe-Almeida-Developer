import { PrismaClient } from '@prisma/client';
import { logger } from './infra/logger.js';
import { ManagementServer } from './infra/management-server.js';
import { RabbitConnection } from './infra/rabbitmq.js';
import { validateWorkerSecurityConfig } from './infra/security-config.js';
import { AuditConsumer } from './services/audit-consumer.js';
import { NotificationConsumer } from './services/notification-consumer.js';
import { OutboxDispatcher } from './services/outbox-dispatcher.js';
import { PrivacyRetentionService } from './services/privacy-retention.js';

const prisma = new PrismaClient();
let shuttingDown = false;
const rabbit = new RabbitConnection(undefined, undefined, (code) => {
  logger.fatal(
    { categoria: 'filas', codigo: code },
    'Falha irrecuperável no RabbitMQ; reiniciando o worker para reassinar consumidores',
  );
  void shutdown(code, 1);
});
const outbox = new OutboxDispatcher(prisma, rabbit);
const auditConsumer = new AuditConsumer(prisma, rabbit);
const notificationConsumer = new NotificationConsumer(prisma, rabbit);
const privacyRetention = new PrivacyRetentionService(prisma);
const managementServer = new ManagementServer(async () => {
  if (!rabbit.isConnected()) return false;
  await prisma.$queryRaw`SELECT 1`;
  return true;
});

async function bootstrap(): Promise<void> {
  validateWorkerSecurityConfig();
  await prisma.$connect();
  await rabbit.connect();
  await auditConsumer.start();
  await notificationConsumer.start();
  await managementServer.start();
  outbox.start();
  privacyRetention.start();

  logger.info(
    { categoria: 'app' },
    'Worker iniciado: outbox, auditoria e notificações assíncronas estão ativos.',
  );
}

async function shutdown(signal: string, exitCode = 0): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ categoria: 'app', signal }, 'Encerrando worker');
  outbox.stop();
  privacyRetention.stop();
  await managementServer.stop();
  await rabbit.close();
  await prisma.$disconnect();
  process.exit(exitCode);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

bootstrap().catch(async (error) => {
  logger.fatal(
    {
      categoria: 'app',
      erro: error instanceof Error ? error.message : String(error),
    },
    'Falha ao iniciar o worker',
  );
  await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
