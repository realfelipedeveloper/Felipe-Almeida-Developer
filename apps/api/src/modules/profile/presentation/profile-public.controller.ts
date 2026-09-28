import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../../shared/presentation/locale-query.dto';
import { ProfilePublicService } from '../application/profile-public.service';

@ApiTags('perfil público')
@Controller('profile')
export class ProfilePublicController {
  constructor(private readonly service: ProfilePublicService) {}

  @Get()
  @ApiOperation({ summary: 'Obtém o perfil profissional público no idioma solicitado' })
  get(@Query() query: LocaleQueryDto) {
    return this.service.get(query.locale);
  }
}
