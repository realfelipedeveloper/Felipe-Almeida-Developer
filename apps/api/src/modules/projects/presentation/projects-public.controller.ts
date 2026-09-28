import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../../shared/presentation/locale-query.dto';
import { SlugParamDto } from '../../../shared/presentation/slug-param.dto';
import { ProjectsPublicService } from '../application/projects-public.service';
import { ProjectListQueryDto } from './project-list-query.dto';

@ApiTags('projetos públicos')
@Controller('projects')
export class ProjectsPublicController {
  constructor(private readonly service: ProjectsPublicService) {}

  @Get()
  @ApiOperation({ summary: 'Lista projetos publicados com filtros e paginação' })
  list(@Query() query: ProjectListQueryDto) {
    return this.service.list(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Obtém um projeto publicado pelo slug localizado' })
  findBySlug(@Param() params: SlugParamDto, @Query() query: LocaleQueryDto) {
    return this.service.findBySlug(query.locale, params.slug);
  }
}
