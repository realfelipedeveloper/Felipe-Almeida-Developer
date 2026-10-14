import { Body, Controller, Header, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithContext } from '../../../shared/presentation/request-context';
import { TurnstileService } from '../../engagement/application/turnstile.service';
import { PrivacyService } from '../application/privacy.service';
import {
  CreatePrivacyRequestDto,
  RecordPrivacyConsentDto,
  VerifyPrivacyRequestDto,
} from './dto/privacy.dto';

@ApiTags('privacidade')
@Controller('privacy')
export class PrivacyController {
  constructor(
    private readonly service: PrivacyService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post('requests')
  @HttpCode(202)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Solicita exportação ou exclusão de dados pessoais' })
  async request(@Body() body: CreatePrivacyRequestDto, @Req() request: RequestWithContext) {
    await this.turnstile.verify(body.turnstileToken, request.ip, body.locale);
    return this.service.request(body, request.ip, request.correlationId);
  }

  @Post('requests/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Verifica e conclui uma solicitação de privacidade' })
  verify(@Body() body: VerifyPrivacyRequestDto, @Req() request: RequestWithContext) {
    return this.service.verify(body.token, request.ip);
  }

  @Post('consents')
  @HttpCode(201)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Registra uma decisão mínima de consentimento de analytics' })
  async recordConsent(@Body() body: RecordPrivacyConsentDto, @Req() request: RequestWithContext) {
    await this.service.recordConsent(body, request.ip);
    return { recorded: true };
  }
}
