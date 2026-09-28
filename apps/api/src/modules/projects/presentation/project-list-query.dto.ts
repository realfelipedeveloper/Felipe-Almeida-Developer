import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PROJECT_LIFECYCLES, type ProjectLifecycle } from '../domain/project';
import { LocaleQueryDto } from '../../../shared/presentation/locale-query.dto';
import { PaginationQueryDto } from '../../../shared/presentation/pagination-query.dto';

export class ProjectListQueryDto extends PaginationQueryDto implements LocaleQueryDto {
  @ApiPropertyOptional({ enum: ['pt-BR', 'en', 'es'], default: 'pt-BR' })
  @IsOptional()
  @IsIn(['pt-BR', 'en', 'es'])
  locale: 'pt-BR' | 'en' | 'es' = 'pt-BR';

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ enum: PROJECT_LIFECYCLES })
  @IsOptional()
  @IsIn(PROJECT_LIFECYCLES)
  lifecycle?: ProjectLifecycle;

  @ApiPropertyOptional({ description: 'Slug da tecnologia.' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  technology?: string;

  @ApiPropertyOptional({ description: 'Slug da tag no idioma solicitado.' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tag?: string;
}
