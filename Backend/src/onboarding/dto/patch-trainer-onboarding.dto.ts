import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CoachStyle,
  ExperienceBand,
  Gender,
  Language,
  RateBand,
  SessionsPerWeek,
  Specialization,
} from '@prisma/client';

export enum TrainerTrainLocationDto {
  GYM = 'GYM',
  CLIENT_HOME = 'CLIENT_HOME',
  OUTDOOR = 'OUTDOOR',
  ONLINE = 'ONLINE',
}

export class OnboardingCertificationDto {
  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  title?: string;
}

export class PatchTrainerOnboardingDto {
  @ApiPropertyOptional({ description: 'Step being saved (1–10, 11 = complete)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(11)
  step?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  headline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ enum: Specialization, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Specialization, { each: true })
  specializations?: Specialization[];

  @ApiPropertyOptional({ enum: ExperienceBand })
  @IsOptional()
  @IsEnum(ExperienceBand)
  experienceBand?: ExperienceBand;

  @ApiPropertyOptional({ enum: TrainerTrainLocationDto, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(TrainerTrainLocationDto, { each: true })
  trainLocations?: TrainerTrainLocationDto[];

  @ApiPropertyOptional({ enum: SessionsPerWeek })
  @IsOptional()
  @IsEnum(SessionsPerWeek)
  sessionsPerWeek?: SessionsPerWeek;

  @ApiPropertyOptional({ enum: RateBand })
  @IsOptional()
  @IsEnum(RateBand)
  rateBand?: RateBand;

  @ApiPropertyOptional({ enum: CoachStyle })
  @IsOptional()
  @IsEnum(CoachStyle)
  coachStyle?: CoachStyle;

  @ApiPropertyOptional({ enum: Language, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Language, { each: true })
  languages?: Language[];

  @ApiPropertyOptional({ type: [OnboardingCertificationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingCertificationDto)
  certifications?: OnboardingCertificationDto[];

  @ApiPropertyOptional({ description: 'Map pin latitude from the app' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ description: 'Map pin longitude from the app' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Human-readable address for the pin' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;
}
