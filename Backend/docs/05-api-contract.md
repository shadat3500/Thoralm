# API contract (MVP)

Base: `https://api.Moveitz.example/v1`  
Auth: `Authorization: Bearer <accessToken>`  
JSON only. Errors:

```json
{ "statusCode": 400, "error": "SLOT_NOT_OPEN", "message": "This time is no longer available." }
```

Prefix: all routes below are under `/v1`.

---

## Auth (`public`)

| Method | Path | Body / notes |
|---|---|---|
| POST | `/auth/register` | `{ fullName, email, phone, password, role }` → tokens + user |
| POST | `/auth/login` | `{ email, password }` → **201** + tokens if onboarding complete. If not: **403** `ONBOARDING_INCOMPLETE` + same tokens + `missing` + `onboardingComplete: false` (so the app can still finish onboarding). |
| POST | `/auth/refresh` | `{ refreshToken }` |
| POST | `/auth/logout` | refresh revoked |
| POST | `/auth/forgot-password` | `{ email }` always 202 |
| POST | `/auth/reset-password` | `{ token, password }` |

Google/Apple: not in MVP.

---

## Me

| Method | Path | Notes |
|---|---|---|
| GET | `/me` | user + profile + `onboardingComplete` + `missing` |
| PATCH | `/me` | name, phone, avatar |
| PATCH | `/me/password` | `{ currentPassword, newPassword }` |
| DELETE | `/me` | soft delete |
| POST | `/me/device` | `{ pushToken, platform }` |

---

## Onboarding

Partial upsert. Client and trainer send only fields for the current step.

| Method | Path |
|---|---|
| GET | `/onboarding` | JWT. Includes `onboardingComplete` (boolean), `onboardingCompletedAt` (date or null), `missing` (string[] of unfinished fields) |
| PATCH | `/onboarding/client` |
| PATCH | `/onboarding/trainer` |
| POST | `/onboarding/complete` |

Location is set on onboarding (not register). App sends map pin `lat` + `lng` and optional `addressText`. Required to complete (`missing` includes `"location"` until both coords exist).

`PATCH /onboarding/client` example:

```json
{
  "step": 6,
  "gender": "MALE",
  "age": 22,
  "weightKg": 80.5,
  "heightCm": 165,
  "goals": ["LOSE_WEIGHT", "GAIN_MUSCLE"],
  "experienceLevel": "BEGINNER",
  "trainLocations": ["GYM"],
  "frequency": "TIMES_3_4_WEEK",
  "coachStyle": "MOTIVATING_ENERGETIC",
  "specialNeeds": [],
  "preferredLanguage": "EN",
  "trainerGenderPref": "NO_PREFERENCE",
  "lat": 23.8103,
  "lng": 90.4125,
  "addressText": "Dhaka"
}
```

---

## Files

| Method | Path | Notes |
|---|---|---|
| POST | `/files` | multipart `file` + `kind=AVATAR\|GALLERY\|CERT\|CHAT` → `{ url, key }` |

---

## Discover (client)

| Method | Path | Notes |
|---|---|---|
| GET | `/discover` | query: `page,lat,lng` → `{ matchCount, items[] }` |
| GET | `/trainers/:id` | public trainer profile + packages + matchPercent |
| POST | `/trainers/:id/like` | favorite |
| POST | `/trainers/:id/skip` | passed, hide in discover |
| DELETE | `/me/favorites/:trainerId` | |

Home mix:

| Method | Path |
|---|---|
| GET | `/home/client` |

Trainer home:

| Method | Path |
|---|---|
| GET | `/home/trainer` |

---

## Requests (trainer inbox)

| Method | Path |
|---|---|
| GET | `/requests?status=NEW\|ALL\|RENEW\|ARCHIVED` |
| POST | `/requests` | client: `{ trainerId }` |
| POST | `/requests/:id/accept` |
| POST | `/requests/:id/decline` |
| POST | `/requests/:id/archive` |

---

## Packages & slots (trainer)

| Method | Path |
|---|---|
| GET | `/packages` |
| POST | `/packages` |
| PATCH | `/packages/:id` |
| GET | `/slots?from=&to=` |
| POST | `/slots` |
| DELETE | `/slots/:id` | only if OPEN |

`POST /slots`:

```json
{
  "packageId": "…",
  "serviceType": "IN_GYM",
  "locationText": "Gold's Gym Downtown",
  "startsAt": "2026-08-21T11:00:00.000Z",
  "endsAt": "2026-08-21T12:00:00.000Z"
}
```

Price preview (no DB write):

| Method | Path |
|---|---|
| POST | `/pricing/preview` | `{ pricePerSessionCents, sessionCount }` → gross, fee, clientPay, trainerEarn |

---

## Bookings

| Method | Path |
|---|---|
| GET | `/bookings?tab=UPCOMING\|COMPLETED` |
| GET | `/bookings/:id` |
| POST | `/bookings` | `{ trainerId, slotId, packageId }` → `{ booking, paymentClientSecret }` |
| POST | `/bookings/:id/accept` | trainer |
| POST | `/bookings/:id/decline` | trainer |
| POST | `/bookings/:id/cancel` | either side |
| POST | `/bookings/:id/reschedule` | `{ slotId }` |
| POST | `/bookings/:id/review` | `{ rating, body }` |

---

## Chat

REST for history; Socket.io for live.

| Method | Path |
|---|---|
| GET | `/conversations` |
| GET | `/conversations/:id/messages?cursor=` |
| POST | `/conversations` | `{ userId }` — allowed only if relationship |
| POST | `/conversations/:id/messages` | `{ type, body, mediaUrl }` |
| POST | `/conversations/:id/read` |
| POST | `/conversations/:id/mute` |
| DELETE | `/conversations/:id` |
| POST | `/users/:id/block` |
| POST | `/users/:id/report` | `{ reason }` |

Socket events: `message:new`, `message:typing`, `presence:update`.

---

## Wallet (trainer)

| Method | Path |
|---|---|
| GET | `/wallet` |
| GET | `/wallet/transactions` |
| POST | `/wallet/withdraw` | **501 stub** in MVP |

---

## Notifications

| Method | Path |
|---|---|
| GET | `/notifications` |
| POST | `/notifications/read-all` |
| PATCH | `/me/notification-settings` |

---

## Clients list (trainer)

| Method | Path |
|---|---|
| GET | `/trainer/clients` | accepted relationship + progress counters |
| GET | `/trainer/clients/:id` | |

---

## Webhooks

| Method | Path |
|---|---|
| POST | `/webhooks/stripe` | raw body |

---

## Error codes

`EMAIL_TAKEN`, `INVALID_CREDENTIALS`, `ONBOARDING_INCOMPLETE`, `SLOT_NOT_OPEN`, `SLOT_HELD`, `BOOKING_NOT_PENDING`, `NOT_PARTICIPANT`, `REVIEW_EXISTS`, `FORBIDDEN_ROLE`, `PAYMENT_FAILED`
