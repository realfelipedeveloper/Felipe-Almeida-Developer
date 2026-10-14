import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PRIVACY_REQUEST_TYPES, PUBLIC_LOCALES } from '../../domain/privacy';

export class CreatePrivacyRequestDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(PRIVACY_REQUEST_TYPES)
  type!: (typeof PRIVACY_REQUEST_TYPES)[number];

  @IsIn(PUBLIC_LOCALES)
  locale!: (typeof PUBLIC_LOCALES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  turnstileToken?: string;
}

export class VerifyPrivacyRequestDto {
  @IsString()
  @MinLength(40)
  @MaxLength(300)
  token!: string;
}

export class RecordPrivacyConsentDto {
  @IsUUID('4')
  subjectId!: string;

  @IsBoolean()
  granted!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(40)
  policyVersion!: string;

  @IsIn(PUBLIC_LOCALES)
  locale!: (typeof PUBLIC_LOCALES)[number];
}
