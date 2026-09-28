import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../../shared/presentation/locale-query.dto';
import { SlugParamDto } from '../../../shared/presentation/slug-param.dto';
import { ArticlesPublicService } from '../application/articles-public.service';
import { ArticleListQueryDto } from './article-list-query.dto';

@ApiTags('artigos públicos')
@Controller('articles')
export class ArticlesPublicController {
  constructor(private readonly service: ArticlesPublicService) {}

  @Get()
  @ApiOperation({ summary: 'Lista artigos publicados com paginação e filtro por tag' })
  list(@Query() query: ArticleListQueryDto) {
    return this.service.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtém um artigo publicado pelo slug localizado' })
  findBySlug(@Param() params: SlugParamDto, @Query() query: LocaleQueryDto) {
    return this.service.findBySlug(query.locale, params.slug);
  }
}
