import { Type } from 'class-transformer';
import { ContactStatus, NewsletterSubscriberStatus, PublicationStatus } from '@prisma/client';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MAX_RICH_TEXT_CHARACTERS } from '../../../../shared/application/rich-text-sanitizer';

const LOCALES = ['pt-BR', 'en', 'es'] as const;

export class ContactListQueryDto {
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;
}

export class NewsletterListQueryDto {
  @IsOptional()
  @IsEnum(NewsletterSubscriberStatus)
  status?: NewsletterSubscriberStatus;
}

export class UpdateContactStatusDto {
  @IsEnum(ContactStatus)
  status!: ContactStatus;
}

export class UpdateNewsletterStatusDto {
  @IsEnum(NewsletterSubscriberStatus)
  status!: NewsletterSubscriberStatus;
}

export class NewsletterIssueTranslationAdminDto {
  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @IsString()
  @MaxLength(220)
  subject!: string;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  previewText?: string | null;

  @IsString()
  @MaxLength(MAX_RICH_TEXT_CHARACTERS)
  bodyHtml!: string;
}

export class UpsertNewsletterIssueAdminDto {
  @IsEnum(PublicationStatus)
  publicationStatus!: PublicationStatus;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string | null;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => NewsletterIssueTranslationAdminDto)
  translations!: NewsletterIssueTranslationAdminDto[];
}
