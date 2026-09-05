# Domain model and states

Visual companion to `02-er-diagram.md` and `04-state-machines.md`.

---

## 1. Core entities

```mermaid
erDiagram
    USER ||--o| CLIENT_PROFILE : has
    USER ||--o| TRAINER_PROFILE : has
    USER ||--o| WALLET : has
    TRAINER_PROFILE ||--o{ PACKAGE : offers
    TRAINER_PROFILE ||--o{ SLOT : publishes
    TRAINER_PROFILE ||--o{ CERTIFICATION : uploads
    USER ||--o{ REQUEST : sends
    USER ||--o{ BOOKING : books
    SLOT ||--o| BOOKING : becomes
    PACKAGE ||--o{ BOOKING : priced_as
    BOOKING ||--o| PAYMENT : charged
    BOOKING ||--o| REVIEW : rated
    USER ||--o{ FAVORITE : likes
    CONVERSATION }o--o{ USER : members
    CONVERSATION ||--o{ MESSAGE : contains
    WALLET ||--o{ LEDGER : tracks

    USER {
        string id PK
        string role
        string email UK
        int onboardingStep
        string status
    }
    CLIENT_PROFILE {
        string userId PK
        int age
        decimal weightKg
        string goals
    }
    TRAINER_PROFILE {
        string userId PK
        int baseRateCents
        decimal avgRating
        string specializations
    }
    SLOT {
        string id PK
        datetime startsAt
        string status
        string serviceType
    }
    BOOKING {
        string id PK
        string status
        int clientPayCents
        int trainerEarnCents
    }
    WALLET {
        string userId PK
        int pendingCents
        int availableCents
    }
```

---

## 2. Booking lifecycle

```mermaid
stateDiagram-v2
    direction LR
    [*] --> PENDING_ACCEPTANCE: client authorizes pay
    PENDING_ACCEPTANCE --> CONFIRMED: trainer accepts
    PENDING_ACCEPTANCE --> DECLINED: decline or 24h timeout
    CONFIRMED --> COMPLETED: session end job
    CONFIRMED --> CANCELLED: cancel + refund policy
    CONFIRMED --> NO_SHOW: marked no-show
    DECLINED --> [*]
    COMPLETED --> [*]
    CANCELLED --> [*]
    NO_SHOW --> [*]
```

---

## 3. Slot lifecycle

```mermaid
stateDiagram-v2
    direction LR
    [*] --> OPEN: trainer publishes
    OPEN --> HELD: checkout started
    HELD --> OPEN: pay fail or 10 min expiry
    HELD --> BOOKED: payment authorized
    BOOKED --> OPEN: booking declined or cancelled
    OPEN --> CANCELLED: trainer removes slot
    BOOKED --> [*]
    CANCELLED --> [*]
```

---

## 4. Client request (trainer inbox)

```mermaid
stateDiagram-v2
    direction LR
    [*] --> NEW: match or request trainer
    NEW --> ACCEPTED: accept
    NEW --> DECLINED: decline
    ACCEPTED --> ARCHIVED: archive
    DECLINED --> ARCHIVED: archive
```

Filters in UI: All / New / Renew / Archive. `RENEW` = request from a client who already had an accepted relationship.

---

## 5. Money

```mermaid
stateDiagram-v2
    direction LR
    [*] --> REQUIRES_CAPTURE: Stripe authorize
    REQUIRES_CAPTURE --> CAPTURED: trainer accept
    REQUIRES_CAPTURE --> CANCELLED: decline or timeout
    CAPTURED --> REFUNDED: cancel after capture

    state Wallet {
        [*] --> PendingEarn: on capture
        PendingEarn --> Available: booking COMPLETED
        Available --> Paid: withdraw later
    }
```

Fee rule (matches trainer Add-slot UI):

```
gross        = pricePerSession x sessionCount
platformFee  = 10% of gross
clientPay    = gross + platformFee
trainerEarn  = gross - platformFee
```

Amounts stored as **integer cents**. No floats.

---

## 6. Delivery roadmap

```mermaid
gantt
    title Moveitz backend MVP
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Stage 0
    Docs + schema + auth     :done, s0, 2026-08-21, 2d

    section Stage 1
    Onboarding + files       :s1, after s0, 4d

    section Stage 2
    Matching + discover      :s2, after s1, 4d

    section Stage 3
    Slots + bookings         :s3, after s2, 5d

    section Stage 4
    Chat realtime            :s4, after s3, 4d

    section Stage 5
    Stripe + wallet + reviews :s5, after s4, 5d
```

Later (not on this chart): Google/Apple login, map search, voice/call, live payouts, Pro Plan.
