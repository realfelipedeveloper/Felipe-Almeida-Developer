import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Verifica se a API está respondendo' })
  @ApiOkResponse({ description: 'API disponível.' })
  getHealth() {
    return this.healthService.getStatus();
  }

  @Get('database')
  @ApiOperation({ summary: 'Verifica a conexão com o PostgreSQL' })
  @ApiOkResponse({ description: 'PostgreSQL disponível.' })
  @ApiServiceUnavailableResponse({ description: 'PostgreSQL indisponível.' })
  async getDatabaseHealth() {
    const result = await this.healthService.getDatabaseStatus();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'Verifica PostgreSQL, Redis e RabbitMQ' })
  @ApiOkResponse({ description: 'Dependências críticas disponíveis.' })
  @ApiServiceUnavailableResponse({ description: 'Uma ou mais dependências estão indisponíveis.' })
  async getDependenciesHealth() {
    const result = await this.healthService.getDependenciesStatus();
    if (result.status !== 'ok') throw new ServiceUnavailableException(result);
    return result;
  }
}
