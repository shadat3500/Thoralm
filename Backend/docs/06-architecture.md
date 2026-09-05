# System architecture

Short client-facing view. Full diagrams: [`10-system-design.md`](10-system-design.md). Locked choices: [`00-decisions.md`](00-decisions.md).

Two mobile apps, **one public API URL**, core + notification service behind a load balancer, one Postgres.

---

## 1. Context — who talks to what

```mermaid
flowchart LR
    clientApp[Client App]
    trainerApp[Trainer App]
    lb[Load balancer]
    core[Core API]
    notify[Notification service]
    stripe[Stripe]
    push[FCM / APNs]
    mail[Email]
    storage[Object Storage]

    clientApp -->|REST + Socket.io| lb
    trainerApp -->|REST + Socket.io| lb
    lb --> core
    lb -->|/v1/notifications| notify
    core -->|Charges and webhooks| stripe
    core -->|events| notify
    notify --> push
    notify --> mail
    core -->|Photos certs chat images| storage
```

| Actor | Role |
|---|---|
| Client App | Find trainers, book, pay, chat, review |
| Trainer App | Publish slots, accept requests, earn, chat |
| Moveitz API | Auth, matching, bookings, chat, wallet |
| Stripe | Card authorize / capture / refund |
| FCM / APNs | Booking and chat push |
| Object storage | Avatars, gallery, certificates, chat images |

---

## 2. Containers — what we actually run

```mermaid
flowchart TB
    subgraph apps [Mobile]
        iosC[Client iOS / Android]
        iosT[Trainer iOS / Android]
    end

    subgraph edge [Edge]
        lb[Nginx / ALB]
    end

    subgraph api [Services]
        nest[Core NestJS + Socket.io]
        notify[Notification HTTP + worker]
    end

    subgraph data [Data]
        pg[(PostgreSQL)]
        redis[(Redis)]
        s3[(S3-compatible)]
    end

    subgraph jobs [Background in core]
        cron[Slot hold expiry]
        complete[Session complete]
        timeout[Accept timeout 24h]
    end

    iosC --> lb
    iosT --> lb
    lb --> nest
    lb --> notify
    nest --> pg
    nest --> redis
    nest --> s3
    nest --> notify
    notify --> pg
    notify --> redis
    cron --> pg
    complete --> pg
    timeout --> pg
```

- **PostgreSQL** — source of truth (users, slots, bookings, chat history, ledger, notification inbox)
- **Redis** — refresh denylist, presence, unread, slot holds, event queue
- **S3** — files only; DB stores URLs
- **Core jobs** — slot hold / session complete / accept timeout (`@nestjs/schedule`)
- **Notify** — push + email; not on the booking HTTP path

---

## 3. Modular monolith — API internals

One deployable. Modules are bounded contexts, not separate services.

```mermaid
flowchart TB
    subgraph http [HTTP /v1]
        gw[Guards JWT + Roles]
    end

    subgraph domain [Domain modules]
        auth[Auth]
        onb[Onboarding]
        match[Matching]
        book[Bookings]
        slot[Slots + Packages]
        chat[Chat]
        pay[Payments]
        wallet[Wallet]
    end

    subgraph infra [Infrastructure]
        prisma[Prisma]
        files[File store]
        stripeMod[Stripe adapter]
    end

    gw --> auth
    gw --> onb
    gw --> match
    gw --> book
    gw --> slot
    gw --> chat
    gw --> pay
    gw --> wallet

    auth --> prisma
    onb --> prisma
    match --> prisma
    book --> prisma
    slot --> prisma
    chat --> prisma
    pay --> prisma
    wallet --> prisma

    onb --> files
    chat --> files
    pay --> stripeMod
```

---

## 4. Request path

```mermaid
sequenceDiagram
    participant App
    participant API
    participant Redis
    participant DB

    App->>API: Bearer access token
    API->>API: JWT verify
    alt Token expired
        App->>API: POST /auth/refresh
        API->>DB: Valid refresh token?
        API-->>App: New access token
    end
    API->>DB: Domain query / write
    API->>Redis: Cache presence / hold
    API-->>App: JSON
```

---

## 5. Trust boundaries

```mermaid
flowchart LR
    subgraph public [Public internet]
        apps[Mobile apps]
        stripeWh[Stripe webhooks]
    end

    subgraph private [Our VPC]
        api[ALB + core + notify]
        db[(Postgres)]
        cache[(Redis)]
    end

    subgraph vendors [Vendors]
        s3[S3]
        stripe[Stripe]
        fcm[Push]
    end

    apps -->|TLS + JWT| api
    stripeWh -->|Signed payload| api
    api --> db
    api --> cache
    api --> s3
    api --> stripe
    api --> fcm
```

Public: `/auth/*`, Stripe webhook. Everything else requires a valid access token and a role check (`CLIENT` vs `TRAINER`).

---

## 6. Environments

| Env | API | DB | Notes |
|---|---|---|---|
| Local | Nginx or `localhost:3000` | Docker Postgres + Redis | Swagger at `/docs`; notify added when split |
| Staging | HTTPS ALB | RDS + Redis | Stripe test keys |
| Production | HTTPS + WSS ALB | RDS + Redis | Stripe live, real push certs |
