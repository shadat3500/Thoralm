import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export enum RegisterRole {
  CLIENT = 'CLIENT',
  TRAINER = 'TRAINER',
}

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: RegisterRole })
  @IsEnum(RegisterRole)
  role: Role;
}
