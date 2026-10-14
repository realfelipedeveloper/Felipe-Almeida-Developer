import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MediaKind } from '@prisma/client';
import { toPrismaLocale } from '../../../../shared/domain/locale.mapper';

const LOCALES = ['pt-BR', 'en', 'es'] as const;

export class MediaListQueryDto {
  @IsOptional()
  @IsEnum(MediaKind)
  kind?: MediaKind;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 24;
}

export class MediaTranslationDto {
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  altText?: string | null;
}

export class UpdateMediaTranslationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MediaTranslationDto)
  translations!: MediaTranslationDto[];

  toApplication() {
    return this.translations.map((item) => ({
      locale: toPrismaLocale(item.locale),
      title: item.title?.trim() || null,
      altText: item.altText?.trim() || null,
    }));
  }
}
