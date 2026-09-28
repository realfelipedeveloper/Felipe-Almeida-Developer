import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../../shared/presentation/locale-query.dto';
import { SlugParamDto } from '../../../shared/presentation/slug-param.dto';
import { NewsPublicService } from '../application/news-public.service';
import { NewsListQueryDto } from './news-list-query.dto';

@ApiTags('notícias públicas')
@Controller('news')
export class NewsPublicController {
  constructor(private readonly service: NewsPublicService) {}

  @Get()
  @ApiOperation({ summary: 'Lista notícias publicadas com paginação e filtro por tag' })
  list(@Query() query: NewsListQueryDto) {
    return this.service.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtém uma notícia publicada pelo slug localizado' })
  findBySlug(@Param() params: SlugParamDto, @Query() query: LocaleQueryDto) {
    return this.service.findBySlug(query.locale, params.slug);
  }
}
