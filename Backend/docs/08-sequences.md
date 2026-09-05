# Sequence diagrams

Time-ordered API calls. These are the contracts mobile should implement against.

---

## 1. Register + login

```mermaid
sequenceDiagram
    participant App
    participant API
    participant DB

    App->>API: POST /v1/auth/register
    API->>DB: Email unique?
    API->>DB: Create user + profile + wallet
    API-->>App: user, accessToken, refreshToken

    App->>API: POST /v1/auth/login
    API->>DB: Load user
    API->>API: bcrypt compare
    API-->>App: user, accessToken, refreshToken

    App->>API: GET /v1/me
    Note over App,API: Authorization Bearer accessToken
    API-->>App: user + profile + onboardingStep
```

Access token TTL: 15 minutes. Refresh: 30 days, rotated on each use.

---

## 2. Token refresh

```mermaid
sequenceDiagram
    participant App
    participant API
    participant DB

    App->>API: POST /v1/auth/refresh
    API->>DB: Hash lookup refresh token
    alt Valid and not revoked
        API->>DB: Revoke old token
        API->>DB: Store new hashed refresh
        API-->>App: New access + refresh
    else Missing expired or revoked
        API-->>App: 401 INVALID_CREDENTIALS
        App->>App: Send user to Sign in
    end
```

---

## 3. Onboarding save

```mermaid
sequenceDiagram
    participant App
    participant API
    participant DB
    participant S3

    App->>API: POST /v1/files kind=AVATAR
    API->>S3: Put object
    API-->>App: url

    App->>API: PATCH /v1/onboarding/client
    API->>DB: Upsert profile fields
    API->>DB: onboardingStep = N
    API-->>App: Updated profile

    App->>API: POST /v1/onboarding/complete
    API->>DB: onboardingCompletedAt = now
    API-->>App: 200
```

Trainer path is the same with `PATCH /v1/onboarding/trainer` plus certification uploads (`kind=CERT`).

---

## 4. Discover + book

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant DB
    participant Stripe
    participant Trainer

    Client->>API: GET /v1/discover
    API->>DB: Score trainers vs client profile
    API-->>Client: matchCount + items

    Client->>API: GET /v1/trainers/id
    API-->>Client: Profile packages slots matchPercent

    Client->>API: POST /v1/bookings
    API->>DB: Slot OPEN to HELD
    API->>Stripe: PaymentIntent authorize
    Stripe-->>API: clientSecret
    API->>DB: Booking PENDING_ACCEPTANCE
    API-->>Client: booking + clientSecret
    API--)Trainer: Push BOOKING_REQUEST

    Trainer->>API: POST /v1/bookings/id/accept
    API->>Stripe: Capture
    API->>DB: CONFIRMED + slot BOOKED
    API->>DB: Wallet pendingCents += earn
    API-->>Trainer: 200
    API--)Client: Push BOOKING_CONFIRMED
```

Decline / 24h timeout voids the PaymentIntent and returns the slot to `OPEN`.

---

## 5. Add slot (trainer)

```mermaid
sequenceDiagram
    participant Trainer
    participant API
    participant DB

    Trainer->>API: POST /v1/pricing/preview
    API-->>Trainer: gross, fee 10%, clientPay, trainerEarn

    Trainer->>API: POST /v1/packages
    API->>DB: Insert package
    API-->>Trainer: package

    Trainer->>API: POST /v1/slots
    API->>DB: Insert OPEN slot
    API-->>Trainer: slot

    Trainer->>API: GET /v1/slots?from&to
    API-->>Trainer: Week or month grid
```

---

## 6. Chat

```mermaid
sequenceDiagram
    participant A as Client
    participant API
    participant WS as Socket.io
    participant DB
    participant B as Trainer

    A->>API: POST /v1/conversations
    API->>DB: Allowed relationship?
    API-->>A: conversation

    A->>WS: message:new
    WS->>DB: Insert message
    WS->>WS: unreadCount++
    WS-->>B: message:new
    B->>API: POST /v1/conversations/id/read
    API->>DB: unreadCount = 0
```

Media: `POST /v1/files kind=CHAT` then send `type=IMAGE` with `mediaUrl`.

---

## 7. Review after session

```mermaid
sequenceDiagram
    participant Job
    participant API
    participant DB
    participant Client

    Job->>DB: CONFIRMED and endsAt passed
    Job->>DB: Status COMPLETED
    Job->>DB: pendingCents to availableCents
    Job--)Client: Push leave a review

    Client->>API: POST /v1/bookings/id/review
    API->>DB: One review per booking
    API->>DB: Recalc trainer avgRating
    API-->>Client: 201
```

---

## 8. Stripe webhook (source of truth for money)

```mermaid
sequenceDiagram
    participant Stripe
    participant API
    participant DB

    Stripe->>API: POST /v1/webhooks/stripe
    API->>API: Verify signature
    alt payment_intent.succeeded
        API->>DB: Payment CAPTURED
    else payment_intent.canceled
        API->>DB: Payment CANCELLED slot OPEN
    else charge.refunded
        API->>DB: Payment REFUNDED ledger refund
    end
    API-->>Stripe: 200
```
