import 'reflect-metadata';

import {
  Body,
  Controller,
  Get,
  INestApplication,
  Post,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { httpSecurityHeaders } from '../src/infra/security/http-security';

class ProbeDto {
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  value!: string;
}

@Controller('api/admin/probe')
class ProbeController {
  @Get()
  get() {
    return { status: 'ok' };
  }

  @Post()
  post(@Body() body: ProbeDto) {
    return body;
  }
}

describe('hardening HTTP (e2e sem infraestrutura externa)', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use(httpSecurityHeaders);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.listen(0, '127.0.0.1');

    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Não foi possível descobrir a porta do teste E2E.');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('envia headers defensivos e impede cache em rotas administrativas', async () => {
    const response = await fetch(`${baseUrl}/api/admin/probe`);

    expect(response.status).toBe(200);
    expect(response.headers.get('x-content-type-options')).toBe(
      'nosniff',
    );
    expect(response.headers.get('x-frame-options')).toBe('DENY');
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(response.headers.get('content-security-policy')).toContain(
      "default-src 'none'",
    );
  });

  it('rejeita propriedades não permitidas pelo ValidationPipe', async () => {
    const response = await fetch(`${baseUrl}/api/admin/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        value: 'ok',
        propriedadeInesperada: 'não deve passar',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('aceita payload válido após validação global', async () => {
    const response = await fetch(`${baseUrl}/api/admin/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'seguro' }),
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ value: 'seguro' });
  });
});
