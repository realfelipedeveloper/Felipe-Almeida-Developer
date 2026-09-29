import { PrismaClient } from '@prisma/client';
import { logger } from './infra/logger.js';
import { RabbitConnection } from './infra/rabbitmq.js';
import { AuditConsumer } from './services/audit-consumer.js';
import { NotificationConsumer } from './services/notification-consumer.js';
import { OutboxDispatcher } from './services/outbox-dispatcher.js';

const prisma = new PrismaClient();
const rabbit = new RabbitConnection();
const outbox = new OutboxDispatcher(prisma, rabbit);
const auditConsumer = new AuditConsumer(prisma, rabbit);
const notificationConsumer = new NotificationConsumer(prisma, rabbit);

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  await rabbit.connect();
  await auditConsumer.start();
  await notificationConsumer.start();
  outbox.start();

  logger.info(
    { categoria: 'app' },
    'Worker iniciado: outbox, auditoria e notificações assíncronas estão ativos.',
  );
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ categoria: 'app', signal }, 'Encerrando worker');
  outbox.stop();
  await rabbit.close();
  await prisma.$disconnect();
  process.exit(0);
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
