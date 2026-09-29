import {
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(128)
  newPassword!: string;
}
