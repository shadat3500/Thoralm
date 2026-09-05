# Enums and lookup values

Values match Figma copy as closely as possible. Store the **enum key** in DB; mobile maps to labels.

## Account

```
Role            = CLIENT | TRAINER | ADMIN
UserStatus      = ACTIVE | DISABLED | DELETED
Gender          = MALE | FEMALE | NON_BINARY | PREFER_NOT_TO_SAY
TrainerGenderPref = MALE | FEMALE | NO_PREFERENCE
```

## Client profile

```
ExperienceLevel = BEGINNER | INTERMEDIATE | ADVANCED

Goal =
  LOSE_WEIGHT
  GAIN_MUSCLE
  GET_STRONGER
  FLEXIBILITY
  GENERAL_HEALTH

TrainLocation (client) = GYM | HOME | OUTDOOR

Frequency =
  TIMES_1_2_WEEK
  TIMES_3_4_WEEK
  TIMES_5_PLUS_WEEK

CoachStyle =
  MOTIVATING_ENERGETIC
  TECHNICAL_PRECISE
  PROFESSIONAL_DISCIPLINED
  SOCIAL_FUN

SpecialNeed =
  INJURY_REHAB
  PREGNANCY_POST
  SENIOR
  NONE

Language = EN | SV | OTHER
```

## Trainer profile

```
Specialization =
  WEIGHT_LOSS
  MUSCLE_BUILDING
  STRENGTH
  SENIORS
  SPORT_PREP
  GENERAL_HEALTH
  PRENATAL
  POSTNATAL
  CORE
  RECOVERY
  MOBILITY
  NUTRITION

ExperienceBand =
  UNDER_1
  Y1_2
  Y2_5
  Y5_10
  OVER_10

TrainLocation (trainer) = GYM | CLIENT_HOME | OUTDOOR | ONLINE

SessionsPerWeek =
  S1_5
  S6_10
  S11_15
  S16_PLUS

RateBand =
  UNDER_50
  R50_100
  R100_150
  OVER_150

CoachStyle (trainer) =
  MOTIVATIONAL_ENERGETIC
  CALM_EDUCATIONAL
  STRUCTURED
  SOCIAL_FUN
```

Client and trainer coach-style keys are **aligned at API level** using the four client values; trainer onboarding maps onto the same four plus `CALM_EDUCATIONAL` stored as `TECHNICAL_PRECISE` if we need one list. **Decision: one shared `CoachStyle` enum** (client list + `CALM_EDUCATIONAL`).

## Scheduling / booking

```
PackageType   = PER_SESSION | DAILY | WEEKLY | MONTHLY
ServiceType   = IN_GYM | ONLINE | CLIENT_HOME
SlotStatus    = OPEN | HELD | BOOKED | CANCELLED
BookingStatus = PENDING_ACCEPTANCE | CONFIRMED | DECLINED | CANCELLED | COMPLETED | NO_SHOW
RequestStatus = NEW | ACCEPTED | DECLINED | ARCHIVED
RequestSource = MATCH | PROFILE | RENEW
```

## Money / files / chat

```
PaymentStatus = REQUIRES_CAPTURE | CAPTURED | CANCELLED | REFUNDED
LedgerType    = EARNING | FEE | WITHDRAWAL | REFUND | ADJUSTMENT
LedgerStatus  = PENDING | AVAILABLE | PAID | FAILED
CertStatus    = PENDING | APPROVED | REJECTED
MessageType   = TEXT | IMAGE | SYSTEM
NotificationType =
  BOOKING_REQUEST
  BOOKING_CONFIRMED
  BOOKING_DECLINED
  BOOKING_CANCELLED
  NEW_MESSAGE
  NEW_REVIEW
  PAYOUT
  SYSTEM
```

## Platform

```
PLATFORM_FEE_BPS = 1000   # 10%
ACCESS_TOKEN_TTL = 15m
REFRESH_TOKEN_TTL = 30d
REQUEST_TIMEOUT  = 24h    # auto-decline pending booking if trainer silent
HOLD_SLOT_TTL    = 10m    # while client is on pay sheet
```
