import { IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Platform } from '@prisma/client';

export class RegisterDeviceDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  pushToken: string;

  @ApiProperty({ enum: Platform })
  @IsEnum(Platform)
  platform: Platform;
}
