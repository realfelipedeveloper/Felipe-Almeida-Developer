import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MaxLength(200)
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 4 })
  @IsString()
  @MinLength(4, { message: 'A nova senha deve possuir pelo menos 4 caracteres.' })
  @MaxLength(200)
  newPassword!: string;
}
