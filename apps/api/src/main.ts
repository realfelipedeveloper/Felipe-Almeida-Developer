import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';

import { AppModule } from './app.module';
import { AppLogger } from './infra/logging/app-logger.service';
import {
  httpSecurityHeaders,
  resolveAllowedOrigins,
  resolveBodyLimit,
  shouldEnableSwagger,
  validateProductionSecurityConfig,
} from './infra/security/http-security';

async function bootstrap() {
  validateProductionSecurityConfig();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = app.get(AppLogger);
  app.useLogger(logger);

  const port = Number(process.env.API_PORT ?? 3333);
  const bodyLimit = resolveBodyLimit();

  const expressApp = app.getHttpAdapter().getInstance();
  if (
    process.env.TRUST_PROXY === 'true' &&
    typeof expressApp?.set === 'function'
  ) {
    expressApp.set('trust proxy', 1);
  }

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(cookieParser());
  app.use(httpSecurityHeaders);

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: resolveAllowedOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    }),
  );

  if (shouldEnableSwagger()) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Felipe Almeida Developer API')
      .setDescription(
        'API do portfólio profissional com NestJS, PostgreSQL/Prisma, Redis e RabbitMQ.',
      )
      .setVersion('0.8.0')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(port, '0.0.0.0');
  logger
    .child('app')
    .info({ porta: port }, `API disponível em http://localhost:${port}/api`);

  if (shouldEnableSwagger()) {
    logger
      .child('app')
      .info({ porta: port }, `Swagger disponível em http://localhost:${port}/docs`);
  }
}

void bootstrap();
