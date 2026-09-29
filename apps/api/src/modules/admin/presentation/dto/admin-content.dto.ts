import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ProjectLifecycle, PublicationStatus } from '@prisma/client';

const LOCALES = ['pt-BR', 'en', 'es'] as const;

export class ProfileTranslationAdminDto {
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @IsString() @MaxLength(160)
  fullName!: string;

  @IsString() @MaxLength(220)
  headline!: string;

  @IsString()
  summary!: string;

  @IsString()
  bio!: string;

  @IsOptional() @IsString() @MaxLength(180)
  seoTitle?: string | null;

  @IsOptional() @IsString() @MaxLength(320)
  seoDescription?: string | null;
}

export class SocialLinkAdminDto {
  @IsString() @MaxLength(80)
  label!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(500)
  url!: string;

  @IsOptional() @IsString() @MaxLength(80)
  iconKey?: string | null;

  @IsOptional() @IsInt() @Min(0)
  sortOrder?: number;

  @IsOptional() @IsBoolean()
  visible?: boolean;
}

export class UpdateProfileAdminDto {
  @IsOptional() @IsEmail() @MaxLength(320)
  publicEmail?: string | null;

  @IsOptional() @IsString() @MaxLength(160)
  publicLocation?: string | null;

  @IsOptional() @IsBoolean()
  availableForWork?: boolean;

  @IsOptional() @IsUUID()
  avatarMediaId?: string | null;

  @IsOptional() @IsUUID()
  resumeMediaId?: string | null;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => ProfileTranslationAdminDto)
  translations!: ProfileTranslationAdminDto[];

  @IsArray() @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => SocialLinkAdminDto)
  socialLinks!: SocialLinkAdminDto[];
}

class SeoTranslationDto {
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @IsString() @MaxLength(180)
  title!: string;

  @IsString() @MaxLength(200)
  slug!: string;

  @IsString()
  summary!: string;

  @IsOptional() @IsString() @MaxLength(180)
  seoTitle?: string | null;

  @IsOptional() @IsString() @MaxLength(320)
  seoDescription?: string | null;
}

export class ProjectTranslationAdminDto extends SeoTranslationDto {
  @IsString()
  description!: string;

  @IsOptional() @IsString()
  challenges?: string | null;

  @IsOptional() @IsString()
  solution?: string | null;

  @IsOptional() @IsString()
  results?: string | null;
}

export class UpsertProjectAdminDto {
  @IsEnum(PublicationStatus)
  publicationStatus!: PublicationStatus;

  @IsEnum(ProjectLifecycle)
  lifecycle!: ProjectLifecycle;

  @IsBoolean()
  featured!: boolean;

  @IsOptional() @IsISO8601()
  startedAt?: string | null;

  @IsOptional() @IsISO8601()
  endedAt?: string | null;

  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(500)
  repositoryUrl?: string | null;

  @IsOptional() @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(500)
  demoUrl?: string | null;

  @IsOptional() @IsUUID()
  coverMediaId?: string | null;

  @IsInt() @Min(0)
  sortOrder!: number;

  @IsOptional() @IsISO8601()
  publishedAt?: string | null;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => ProjectTranslationAdminDto)
  translations!: ProjectTranslationAdminDto[];

  @IsArray() @IsUUID('4', { each: true })
  technologyIds!: string[];

  @IsArray() @IsUUID('4', { each: true })
  tagIds!: string[];
}

export class ArticleTranslationAdminDto extends SeoTranslationDto {
  @IsString()
  bodyHtml!: string;
}

export class UpsertArticleAdminDto {
  @IsEnum(PublicationStatus)
  publicationStatus!: PublicationStatus;

  @IsOptional() @IsUUID()
  authorProfileId?: string | null;

  @IsOptional() @IsUUID()
  coverMediaId?: string | null;

  @IsOptional() @IsInt() @Min(1)
  readingTimeMinutes?: number | null;

  @IsOptional() @IsISO8601()
  scheduledAt?: string | null;

  @IsOptional() @IsISO8601()
  publishedAt?: string | null;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => ArticleTranslationAdminDto)
  translations!: ArticleTranslationAdminDto[];

  @IsArray() @IsUUID('4', { each: true })
  tagIds!: string[];
}

export class NewsTranslationAdminDto extends SeoTranslationDto {
  @IsString()
  contentHtml!: string;
}

export class UpsertNewsAdminDto {
  @IsEnum(PublicationStatus)
  publicationStatus!: PublicationStatus;

  @IsOptional() @IsUUID()
  coverMediaId?: string | null;

  @IsOptional() @IsISO8601()
  publishedAt?: string | null;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3)
  @ValidateNested({ each: true }) @Type(() => NewsTranslationAdminDto)
  translations!: NewsTranslationAdminDto[];

  @IsArray() @IsUUID('4', { each: true })
  tagIds!: string[];
}
