import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type SupportedLocale } from '../domain/locale';

export class LocaleQueryDto {
  @ApiPropertyOptional({ enum: SUPPORTED_LOCALES, default: DEFAULT_LOCALE })
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  locale: SupportedLocale = DEFAULT_LOCALE;
}
