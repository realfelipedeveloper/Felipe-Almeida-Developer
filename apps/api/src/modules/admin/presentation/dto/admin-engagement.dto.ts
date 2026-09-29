import {
  ContactStatus,
  NewsletterSubscriberStatus,
} from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

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
