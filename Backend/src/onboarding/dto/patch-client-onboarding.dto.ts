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
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  CoachStyle,
  ExperienceLevel,
  Frequency,
  Gender,
  Goal,
  Language,
  SpecialNeed,
  TrainerGenderPref,
} from '@prisma/client';

export enum ClientTrainLocationDto {
  GYM = 'GYM',
  HOME = 'HOME',
  OUTDOOR = 'OUTDOOR',
}

export class PatchClientOnboardingDto {
  @ApiPropertyOptional({ description: 'Step being saved (1–13, 14 = complete)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
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
  @Type(() => Number)
  @IsInt()
  @Min(13)
  @Max(100)
  age?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(20)
  @Max(400)
  weightKg?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ enum: Goal, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(Goal, { each: true })
  goals?: Goal[];

  @ApiPropertyOptional({ enum: ExperienceLevel })
  @IsOptional()
  @IsEnum(ExperienceLevel)
  experienceLevel?: ExperienceLevel;

  @ApiPropertyOptional({ enum: ClientTrainLocationDto, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(ClientTrainLocationDto, { each: true })
  trainLocations?: ClientTrainLocationDto[];

  @ApiPropertyOptional({ enum: Frequency })
  @IsOptional()
  @IsEnum(Frequency)
  frequency?: Frequency;

  @ApiPropertyOptional({ enum: CoachStyle })
  @IsOptional()
  @IsEnum(CoachStyle)
  coachStyle?: CoachStyle;

  @ApiPropertyOptional({ enum: SpecialNeed, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(SpecialNeed, { each: true })
  specialNeeds?: SpecialNeed[];

  @ApiPropertyOptional({ enum: Language })
  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;

  @ApiPropertyOptional({ enum: TrainerGenderPref })
  @IsOptional()
  @IsEnum(TrainerGenderPref)
  trainerGenderPref?: TrainerGenderPref;

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
