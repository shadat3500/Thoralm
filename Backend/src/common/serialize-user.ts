import {
  ClientProfile,
  Certification,
  TrainerProfile,
  User,
} from '@prisma/client';

export const publicUserSelect = {
  id: true,
  role: true,
  email: true,
  phone: true,
  fullName: true,
  avatarUrl: true,
  onboardingStep: true,
  onboardingCompletedAt: true,
  status: true,
  createdAt: true,
} as const;

export type PublicUser = Pick<
  User,
  | 'id'
  | 'role'
  | 'email'
  | 'phone'
  | 'fullName'
  | 'avatarUrl'
  | 'onboardingStep'
  | 'onboardingCompletedAt'
  | 'status'
  | 'createdAt'
>;

export function serializeClientProfile(profile: ClientProfile | null) {
  if (!profile) return null;
  return {
    gender: profile.gender,
    age: profile.age,
    weightKg: decimalToNumber(profile.weightKg),
    heightCm: profile.heightCm,
    experienceLevel: profile.experienceLevel,
    frequency: profile.frequency,
    coachStyle: profile.coachStyle,
    preferredLanguage: profile.preferredLanguage,
    trainerGenderPref: profile.trainerGenderPref,
    goals: profile.goals,
    trainLocations: profile.trainLocations,
    specialNeeds: profile.specialNeeds,
    addressText: profile.addressText,
    lat: decimalToNumber(profile.lat),
    lng: decimalToNumber(profile.lng),
  };
}

export function serializeTrainerProfile(
  profile: TrainerProfile | null,
  certifications: Certification[] = [],
) {
  if (!profile) return null;
  return {
    gender: profile.gender,
    headline: profile.headline,
    bio: profile.bio,
    experienceBand: profile.experienceBand,
    sessionsPerWeek: profile.sessionsPerWeek,
    rateBand: profile.rateBand,
    baseRateCents: profile.baseRateCents,
    coachStyle: profile.coachStyle,
    languages: profile.languages,
    specializations: profile.specializations,
    trainLocations: profile.trainLocations,
    avgRating: decimalToNumber(profile.avgRating),
    reviewCount: profile.reviewCount,
    sessionCount: profile.sessionCount,
    clientCount: profile.clientCount,
    addressText: profile.addressText,
    lat: decimalToNumber(profile.lat),
    lng: decimalToNumber(profile.lng),
    certifications: certifications.map((c) => ({
      id: c.id,
      fileUrl: c.fileUrl,
      title: c.title,
      status: c.status,
      createdAt: c.createdAt,
    })),
  };
}

function decimalToNumber(value: { toNumber?: () => number } | number | null) {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  return typeof value.toNumber === 'function' ? value.toNumber() : Number(value);
}
