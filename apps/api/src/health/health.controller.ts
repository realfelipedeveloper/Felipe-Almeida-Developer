import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se a API está respondendo' })
  @ApiOkResponse({
    description: 'API disponível.',
    schema: {
      example: {
        status: 'ok',
        service: 'felipe-almeida-developer-api',
        version: '0.3.0',
        timestamp: '2026-09-28T15:00:00.000Z',
      },
    },
  })
  getHealth() {
    return this.healthService.getStatus();
  }

  @Get('database')
  @ApiOperation({ summary: 'Verifica a conexão com o PostgreSQL' })
  @ApiOkResponse({
    description: 'PostgreSQL disponível.',
    schema: {
      example: {
        status: 'ok',
        database: 'postgresql',
        latencyMs: 3,
        timestamp: '2026-09-28T15:00:00.000Z',
      },
    },
  })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL indisponível.' })
  async getDatabaseHealth() {
    const result = await this.healthService.getDatabaseStatus();

    if (result.status !== 'ok') {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }
}
