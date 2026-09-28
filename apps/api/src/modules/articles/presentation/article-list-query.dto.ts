import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { PaginationQueryDto } from '../../../shared/presentation/pagination-query.dto';

export class ArticleListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['pt-BR', 'en', 'es'], default: 'pt-BR' })
  @IsOptional()
  @IsIn(['pt-BR', 'en', 'es'])
  locale: 'pt-BR' | 'en' | 'es' = 'pt-BR';

  @ApiPropertyOptional({ description: 'Slug da tag no idioma solicitado.' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  tag?: string;
}
