import { HttpStatus, Injectable } from '@nestjs/common';
import { Role, TrainLocation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApiError } from '../common/api-error';
import {
  serializeClientProfile,
  serializeTrainerProfile,
} from '../common/serialize-user';
import { PatchClientOnboardingDto } from './dto/patch-client-onboarding.dto';
import { PatchTrainerOnboardingDto } from './dto/patch-trainer-onboarding.dto';
import {
  onboardingStatus,
  missingOnboardingFields,
} from './onboarding-fields';

export const CLIENT_ONBOARDING_STEPS = 14;
export const TRAINER_ONBOARDING_STEPS = 11;

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const user = await this.loadUser(userId);
    return this.toResponse(user);
  }

  async patchClient(userId: string, role: string, dto: PatchClientOnboardingDto) {
    this.assertRole(role, Role.CLIENT);
    const user = await this.loadUser(userId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.avatarUrl) {
        await tx.user.update({
          where: { id: userId },
          data: { avatarUrl: dto.avatarUrl },
        });
      }

      await tx.clientProfile.upsert({
        where: { userId },
        create: {
          userId,
          gender: dto.gender,
          age: dto.age,
          weightKg: dto.weightKg,
          heightCm: dto.heightCm,
          experienceLevel: dto.experienceLevel,
          frequency: dto.frequency,
          coachStyle: dto.coachStyle,
          preferredLanguage: dto.preferredLanguage,
          trainerGenderPref: dto.trainerGenderPref,
          goals: dto.goals ?? [],
          trainLocations: (dto.trainLocations as TrainLocation[] | undefined) ?? [],
          specialNeeds: dto.specialNeeds ?? [],
          ...locationWrite(dto),
        },
        update: {
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.age !== undefined ? { age: dto.age } : {}),
          ...(dto.weightKg !== undefined ? { weightKg: dto.weightKg } : {}),
          ...(dto.heightCm !== undefined ? { heightCm: dto.heightCm } : {}),
          ...(dto.experienceLevel !== undefined
            ? { experienceLevel: dto.experienceLevel }
            : {}),
          ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
          ...(dto.coachStyle !== undefined ? { coachStyle: dto.coachStyle } : {}),
          ...(dto.preferredLanguage !== undefined
            ? { preferredLanguage: dto.preferredLanguage }
            : {}),
          ...(dto.trainerGenderPref !== undefined
            ? { trainerGenderPref: dto.trainerGenderPref }
            : {}),
          ...(dto.goals !== undefined ? { goals: dto.goals } : {}),
          ...(dto.trainLocations !== undefined
            ? { trainLocations: dto.trainLocations as TrainLocation[] }
            : {}),
          ...(dto.specialNeeds !== undefined
            ? { specialNeeds: dto.specialNeeds }
            : {}),
          ...locationWrite(dto),
        },
      });

      if (dto.step !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingStep: Math.max(user.onboardingStep, dto.step),
          },
        });
      }
    });

    return this.toResponse(await this.loadUser(userId));
  }

  async patchTrainer(
    userId: string,
    role: string,
    dto: PatchTrainerOnboardingDto,
  ) {
    this.assertRole(role, Role.TRAINER);
    const user = await this.loadUser(userId);

    await this.prisma.$transaction(async (tx) => {
      if (dto.avatarUrl) {
        await tx.user.update({
          where: { id: userId },
          data: { avatarUrl: dto.avatarUrl },
        });
      }

      await tx.trainerProfile.upsert({
        where: { userId },
        create: {
          userId,
          gender: dto.gender,
          headline: dto.headline,
          bio: dto.bio,
          experienceBand: dto.experienceBand,
          sessionsPerWeek: dto.sessionsPerWeek,
          rateBand: dto.rateBand,
          coachStyle: dto.coachStyle,
          languages: dto.languages ?? [],
          specializations: dto.specializations ?? [],
          trainLocations: (dto.trainLocations as TrainLocation[] | undefined) ?? [],
          ...locationWrite(dto),
        },
        update: {
          ...(dto.gender !== undefined ? { gender: dto.gender } : {}),
          ...(dto.headline !== undefined ? { headline: dto.headline } : {}),
          ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
          ...(dto.experienceBand !== undefined
            ? { experienceBand: dto.experienceBand }
            : {}),
          ...(dto.sessionsPerWeek !== undefined
            ? { sessionsPerWeek: dto.sessionsPerWeek }
            : {}),
          ...(dto.rateBand !== undefined ? { rateBand: dto.rateBand } : {}),
          ...(dto.coachStyle !== undefined ? { coachStyle: dto.coachStyle } : {}),
          ...(dto.languages !== undefined ? { languages: dto.languages } : {}),
          ...(dto.specializations !== undefined
            ? { specializations: dto.specializations }
            : {}),
          ...(dto.trainLocations !== undefined
            ? { trainLocations: dto.trainLocations as TrainLocation[] }
            : {}),
          ...locationWrite(dto),
        },
      });

      if (dto.certifications?.length) {
        const rows = dto.certifications.filter((c) => c.fileUrl);
        if (rows.length) {
          await tx.certification.createMany({
            data: rows.map((c) => ({
              trainerId: userId,
              fileUrl: c.fileUrl,
              title: c.title,
            })),
          });
        }
      }

      if (dto.step !== undefined) {
        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingStep: Math.max(user.onboardingStep, dto.step),
          },
        });
      }
    });

    return this.toResponse(await this.loadUser(userId));
  }

  async complete(userId: string) {
    const user = await this.loadUser(userId);
    const missing = missingOnboardingFields(user);
    if (user.onboardingCompletedAt && missing.length === 0) {
      return this.toResponse(user);
    }

    if (missing.length) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'ONBOARDING_INCOMPLETE',
        `Missing required fields: ${missing.join(', ')}`,
      );
    }

    const total =
      user.role === Role.TRAINER
        ? TRAINER_ONBOARDING_STEPS
        : CLIENT_ONBOARDING_STEPS;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompletedAt: new Date(),
        onboardingStep: total,
      },
    });

    return this.toResponse(await this.loadUser(userId));
  }

  private assertRole(actual: string, expected: Role) {
    if (actual !== expected) {
      throw new ApiError(
        HttpStatus.FORBIDDEN,
        'FORBIDDEN_ROLE',
        `This onboarding path is for ${expected} accounts.`,
      );
    }
  }

  private async loadUser(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        clientProfile: true,
        trainerProfile: { include: { certifications: true } },
      },
    });
  }

  private toResponse(user: Awaited<ReturnType<OnboardingService['loadUser']>>) {
    const total =
      user.role === Role.TRAINER
        ? TRAINER_ONBOARDING_STEPS
        : CLIENT_ONBOARDING_STEPS;

    const { missing, onboardingComplete } = onboardingStatus(user);

    return {
      role: user.role,
      onboardingStep: user.onboardingStep,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingComplete,
      missing,
      totalSteps: total,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
      },
      clientProfile: serializeClientProfile(user.clientProfile),
      trainerProfile: serializeTrainerProfile(
        user.trainerProfile,
        user.trainerProfile?.certifications ?? [],
      ),
    };
  }
}

function locationWrite(dto: {
  lat?: number;
  lng?: number;
  addressText?: string;
}) {
  if ((dto.lat === undefined) !== (dto.lng === undefined)) {
    throw new ApiError(
      HttpStatus.BAD_REQUEST,
      'VALIDATION_ERROR',
      'lat and lng must be sent together.',
    );
  }
  return {
    ...(dto.lat !== undefined ? { lat: dto.lat } : {}),
    ...(dto.lng !== undefined ? { lng: dto.lng } : {}),
    ...(dto.addressText !== undefined ? { addressText: dto.addressText } : {}),
  };
}
