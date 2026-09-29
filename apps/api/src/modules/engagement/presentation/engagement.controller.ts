import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { RequestWithContext } from '../../../shared/presentation/request-context';
import { EngagementService } from '../application/engagement.service';
import { TurnstileService } from '../application/turnstile.service';
import {
  ContactMessageDto,
  NewsletterSubscribeDto,
  NewsletterTokenDto,
} from './dto/engagement.dto';

@ApiTags('contato e newsletter')
@Controller()
export class EngagementController {
  constructor(
    private readonly service: EngagementService,
    private readonly turnstile: TurnstileService,
  ) {}

  @Post('contact')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Recebe uma mensagem do formulário público de contato',
  })
  async contact(
    @Body() body: ContactMessageDto,
    @Req() request: RequestWithContext,
  ) {
    await this.turnstile.verify(
      body.turnstileToken,
      request.ip,
      body.locale,
    );

    return this.service.submitContact(
      body,
      request.ip,
      request.correlationId,
    );
  }

  @Post('newsletter/subscribe')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Solicita inscrição na newsletter com double opt-in',
  })
  async subscribe(
    @Body() body: NewsletterSubscribeDto,
    @Req() request: RequestWithContext,
  ) {
    await this.turnstile.verify(
      body.turnstileToken,
      request.ip,
      body.locale,
    );

    return this.service.subscribe(
      body,
      request.ip,
      request.correlationId,
    );
  }

  @Post('newsletter/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: 'Confirma uma inscrição da newsletter' })
  confirm(@Body() body: NewsletterTokenDto) {
    return this.service.confirm(body.token);
  }

  @Post('newsletter/unsubscribe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancela uma inscrição da newsletter' })
  unsubscribe(@Body() body: NewsletterTokenDto) {
    return this.service.unsubscribe(body.token);
  }
}
