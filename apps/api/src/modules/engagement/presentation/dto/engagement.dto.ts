import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const LOCALES = ['pt-BR', 'en', 'es'] as const;

export class ContactMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  subject!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(5_000)
  message!: string;

  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  /**
   * Honeypot: usuários reais nunca preenchem este campo.
   */
  @IsOptional()
  @IsString()
  @MaxLength(240)
  website?: string;

  /**
   * Token do Cloudflare Turnstile.
   * Só é obrigatório funcionalmente quando TURNSTILE_SECRET_KEY está configurada.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  turnstileToken?: string;
}

export class NewsletterSubscribeDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsIn(LOCALES)
  locale!: (typeof LOCALES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(240)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2_048)
  turnstileToken?: string;
}

export class NewsletterTokenDto {
  @IsString()
  @MinLength(40)
  @MaxLength(300)
  token!: string;
}
