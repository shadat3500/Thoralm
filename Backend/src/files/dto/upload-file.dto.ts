import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { FileKind } from '@prisma/client';

export class UploadFileDto {
  @ApiProperty({ enum: FileKind })
  @IsEnum(FileKind)
  kind: FileKind;
}
