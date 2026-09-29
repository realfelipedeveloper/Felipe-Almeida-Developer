import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import { AppLogger } from './infra/logging/app-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const port = Number(process.env.API_PORT ?? 3333);
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';

  app.use(cookieParser());
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableCors({ origin: [webUrl], credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Felipe Almeida Developer API')
    .setDescription('API do portfólio profissional com NestJS, PostgreSQL/Prisma, Redis e RabbitMQ.')
    .setVersion('0.6.0')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port, '0.0.0.0');
  logger.child('app').info({ porta: port }, `API disponível em http://localhost:${port}/api`);
  logger.child('app').info({ porta: port }, `Swagger disponível em http://localhost:${port}/docs`);
}

void bootstrap();
