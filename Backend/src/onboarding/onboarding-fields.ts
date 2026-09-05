import { Role } from '@prisma/client';

type ProfileLoc = {
  lat: { toNumber?: () => number } | number | null;
  lng: { toNumber?: () => number } | number | null;
};

function hasPin(p: ProfileLoc | null | undefined) {
  return p != null && p.lat != null && p.lng != null;
}

export function isOnboardingComplete(completedAt: Date | null | undefined) {
  return completedAt != null;
}

export function onboardingStatus(user: Parameters<typeof missingOnboardingFields>[0] & {
  onboardingCompletedAt: Date | null;
}) {
  const missing = missingOnboardingFields(user);
  return {
    missing,
    onboardingComplete:
      isOnboardingComplete(user.onboardingCompletedAt) && missing.length === 0,
  };
}

export function missingOnboardingFields(user: {
  role: string;
  avatarUrl: string | null;
  clientProfile: {
    gender: unknown;
    age: number | null;
    weightKg: unknown;
    heightCm: number | null;
    goals: unknown[];
    experienceLevel: unknown;
    trainLocations: unknown[];
    frequency: unknown;
    coachStyle: unknown;
    preferredLanguage: unknown;
    trainerGenderPref: unknown;
    lat: unknown;
    lng: unknown;
  } | null;
  trainerProfile: {
    gender: unknown;
    specializations: unknown[];
    experienceBand: unknown;
    trainLocations: unknown[];
    sessionsPerWeek: unknown;
    rateBand: unknown;
    coachStyle: unknown;
    languages: unknown[];
    lat: unknown;
    lng: unknown;
  } | null;
}): string[] {
  if (user.role === Role.CLIENT) {
    const p = user.clientProfile;
    const missing: string[] = [];
    if (!p?.gender) missing.push('gender');
    if (p?.age == null) missing.push('age');
    if (p?.weightKg == null) missing.push('weightKg');
    if (p?.heightCm == null) missing.push('heightCm');
    if (!p?.goals.length) missing.push('goals');
    if (!p?.experienceLevel) missing.push('experienceLevel');
    if (!p?.trainLocations.length) missing.push('trainLocations');
    if (!p?.frequency) missing.push('frequency');
    if (!p?.coachStyle) missing.push('coachStyle');
    if (!p?.preferredLanguage) missing.push('preferredLanguage');
    if (!p?.trainerGenderPref) missing.push('trainerGenderPref');
    if (!hasPin(p as ProfileLoc | null)) missing.push('location');
    return missing;
  }

  if (user.role === Role.TRAINER) {
    const p = user.trainerProfile;
    const missing: string[] = [];
    if (!user.avatarUrl) missing.push('avatarUrl');
    if (!p?.gender) missing.push('gender');
    if (!p?.specializations.length) missing.push('specializations');
    if (!p?.experienceBand) missing.push('experienceBand');
    if (!p?.trainLocations.length) missing.push('trainLocations');
    if (!p?.sessionsPerWeek) missing.push('sessionsPerWeek');
    if (!p?.rateBand) missing.push('rateBand');
    if (!p?.coachStyle) missing.push('coachStyle');
    if (!p?.languages.length) missing.push('languages');
    if (!hasPin(p as ProfileLoc | null)) missing.push('location');
    return missing;
  }

  return [];
}
