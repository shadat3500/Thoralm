# Moveitz — system design

Full design for what we locked in [`00-decisions.md`](00-decisions.md). Product detail lives in `01`–`09`. This file is **how it is built, routed, stored, scaled, tested, and deployed**.

**Shape:** two mobile apps → **one public URL** → load balancer → **core API** (modular monolith) + **notification service** (the only microservice). Auth stays inside core.

**Target:** ~100k registered users (not 100k concurrent). Kubernetes is **not** in this design; the app stays portable (Docker + health + env) if we add it later.

---

## 1. Goals and constraints

| Kind | Requirement |
|---|---|
| Functional | Auth, onboarding, discover/match, calendar slots, booking, chat, Stripe pay, reviews, wallet, notifications |
| Non-functional | HTTPS, JWT, RBAC, ~100k accounts, horizontal scale of **stateless** API, no secrets in git |
| Learn / lab | One real microservice + load balancer + unit/integration + k6 later + AWS (ECS, not K8s) |
| Out | Extra domain services, Mongo, GraphQL, Kafka, OAuth before email, K8s in v1 |

---

## 2. Context (C4 — system)

Who talks to Moveitz. Mobile never calls Stripe, FCM, or the notification process directly.

```mermaid
C4Context
    title Moveitz context
    Person(client, "Client", "Finds trainer, books, pays, chats")
    Person(trainer, "Trainer", "Publishes slots, accepts, earns, chats")
    Person(admin, "Admin", "Support / disable users — later")

    System(Moveitz, "Moveitz", "Marketplace backend behind one API URL")

    System_Ext(stripe, "Stripe", "Authorize, capture, refund, webhooks")
    System_Ext(fcm, "FCM / APNs", "Push")
    System_Ext(ses, "Email (SES / SMTP)", "Reset, receipts, notify")
    System_Ext(s3, "Object storage", "Avatars, certs, chat images")

    Rel(client, Moveitz, "HTTPS REST + WSS")
    Rel(trainer, Moveitz, "HTTPS REST + WSS")
    Rel(admin, Moveitz, "HTTPS REST")
    Rel(Moveitz, stripe, "PaymentIntents + webhooks")
    Rel(Moveitz, fcm, "Push send")
    Rel(Moveitz, ses, "Transactional mail")
    Rel(Moveitz, s3, "Put / signed get")
```

If C4 does not render, equivalent flow:

```mermaid
flowchart LR
    C[Client app]
    T[Trainer app]
    LB[Load balancer<br/>api.Moveitz.*]
    CORE[Core API]
    NOTIFY[Notification service]
    PG[(PostgreSQL)]
    RD[(Redis)]
    S3[S3]
    ST[Stripe]
    PUSH[FCM / APNs]
    MAIL[Email]

    C --> LB
    T --> LB
    LB -->|REST + Socket.io| CORE
    LB -->|/v1/notifications| NOTIFY
    CORE --> PG
    CORE --> RD
    CORE --> S3
    CORE --> ST
    CORE -->|queue / events| NOTIFY
    NOTIFY --> PG
    NOTIFY --> RD
    NOTIFY --> PUSH
    NOTIFY --> MAIL
    ST -->|webhook| CORE
```

---

## 3. Containers — what we run

### 3.1 Local (Docker Compose)

```mermaid
flowchart TB
    subgraph host [Developer machine]
        APP[Mobile / Postman]
        NGX[Nginx :80]
        CORE[core :3000]
        NOTIFY[notify :3001]
        PG[(Postgres)]
        RD[(Redis)]
        MINIO[MinIO / local S3]
    end

    APP --> NGX
    NGX -->|/v1/notifications| NOTIFY
    NGX -->|/v1/* and /socket.io| CORE
    CORE --> PG
    CORE --> RD
    CORE --> MINIO
    NOTIFY --> PG
    NOTIFY --> RD
```

Until the notify service exists, Compose can run **only core + Postgres + Redis**; Nginx is added when we split.

### 3.2 AWS (target)

```mermaid
flowchart TB
    subgraph internet [Internet]
        MOB[Mobile apps]
        STRIPE[Stripe]
    end

    subgraph edge [Public]
        R53[Route 53]
        ACM[ACM TLS]
        ALB[ALB]
    end

    subgraph vpc [VPC]
        subgraph pub [Public subnets]
            ALB
        end
        subgraph priv [Private subnets]
            ECS1[ECS Fargate: core]
            ECS2[ECS Fargate: notify]
            RDS[(RDS PostgreSQL)]
            REDIS[(ElastiCache Redis)]
        end
    end

    subgraph aws [AWS managed]
        ECR[ECR images]
        S3[S3]
        SES[SES]
        SM[Secrets Manager]
        CW[CloudWatch logs + alarms]
    end

    MOB --> R53
    R53 --> ALB
    ACM --- ALB
    ALB -->|HTTP host/path| ECS1
    ALB -->|/v1/notifications| ECS2
    STRIPE -->|webhook HTTPS| ALB
    ECS1 --> RDS
    ECS1 --> REDIS
    ECS1 --> S3
    ECS1 --> SM
    ECS2 --> RDS
    ECS2 --> REDIS
    ECS2 --> SES
    ECS2 --> SM
    ECS1 --> CW
    ECS2 --> CW
    ECR --> ECS1
    ECR --> ECS2
```

| Piece | Role |
|---|---|
| ALB | TLS terminate, path routing, health checks, later extra core tasks |
| ECS Fargate × 2 | `core`, `notify` — no EC2 to patch |
| RDS Postgres | Source of truth |
| ElastiCache Redis | Holds, denylist, presence, queue (or SQS later) |
| S3 | Files |
| SES | Email |
| Secrets Manager | DB URL, JWT secrets, Stripe keys |
| ECR + GitHub Actions | Build/push/deploy |

**Not in v1:** EKS, NAT-heavy mesh, API Gateway (WebSocket is simpler on ALB → ECS).

---

## 4. Load balancer routing

Mobile uses **one base URL** (e.g. `https://api.Moveitz.example/v1`).

```mermaid
flowchart TB
    REQ[Request]
    REQ --> ALB{ALB / Nginx}

    ALB -->|POST /v1/webhooks/stripe| CORE
    ALB -->|/socket.io| CORE
    ALB -->|/v1/notifications/*| NOTIFY
    ALB -->|/v1/* else| CORE
    ALB -->|/health /ready| same target as path
```

| Path | Target | Auth |
|---|---|---|
| `/v1/auth/*`, `/v1/me`, rest of product API | Core | Public auth routes; else JWT |
| `/v1/notifications` list/read | Notify | JWT (same secret/issuer as core) |
| `/socket.io` | Core | JWT on handshake |
| `/v1/webhooks/stripe` | Core | Stripe signature, no JWT |

Notify **verifies JWT locally** (shared `JWT_ACCESS_SECRET`). It does **not** call core on every request.

WebSocket: ALB **sticky sessions** *or* Socket.io **Redis adapter** (prefer adapter so any core task can own the socket).

---

## 5. Core API — modular monolith

One deployable. Modules = bounded contexts.

```mermaid
flowchart TB
    subgraph edge [Core process]
        HTTP[HTTP /v1]
        WS[Socket.io]
        CRON[Schedulers]
        GW[JWT + Roles guards]
    end

    subgraph domain [Modules]
        AUTH[Auth]
        ONB[Onboarding]
        MATCH[Matching]
        SLOT[Packages + Slots]
        BOOK[Bookings]
        CHAT[Chat]
        PAY[Payments]
        WAL[Wallet]
        FILE[Files]
        DEV[Devices]
    end

    subgraph infra [Adapters]
        PRISMA[Prisma]
        S3A[S3]
        STR[Stripe]
        Q[Queue publisher]
    end

    HTTP --> GW --> AUTH
    GW --> ONB
    GW --> MATCH
    GW --> SLOT
    GW --> BOOK
    GW --> CHAT
    GW --> PAY
    GW --> WAL
    GW --> FILE
    WS --> CHAT
    CRON --> BOOK
    CRON --> SLOT

    AUTH --> PRISMA
    ONB --> PRISMA
    MATCH --> PRISMA
    SLOT --> PRISMA
    BOOK --> PRISMA
    CHAT --> PRISMA
    PAY --> PRISMA
    WAL --> PRISMA
    FILE --> S3A
    PAY --> STR
    BOOK --> Q
    CHAT --> Q
    AUTH --> Q
```

Core **does not send FCM/email** on the request thread. It writes DB + publishes an event (`booking.requested`, `message.created`, …).

---

## 6. Notification microservice

**Owns:** in-app notification rows, push, email, retries, device-token *send*.  
**Does not own:** users, bookings, chat history (reads IDs + copy from the event).

```mermaid
flowchart LR
    CORE[Core] -->|Redis stream / BullMQ / SQS| Q[Queue]
    Q --> W[Notify worker]
    W --> DB[(notifications table)]
    W --> FCM[FCM / APNs]
    W --> MAIL[SES]
    APP[App] -->|GET /v1/notifications| API[Notify HTTP]
    API --> DB
```

```mermaid
sequenceDiagram
    participant Core
    participant Q as Queue
    participant N as Notify worker
    participant Push as FCM/APNs
    participant App

    Core->>Core: Booking PENDING_ACCEPTANCE
    Core->>Q: booking.requested {userId, bookingId, title}
    Core-->>App: 201 booking (fast)
    Q->>N: Deliver
    N->>N: Insert notification row
    N->>Push: Send
    Note over N,Push: Fail → retry / DLQ; core already succeeded
    App->>N: GET /v1/notifications
    N-->>App: Inbox
```

Failure: notify down → booking still works; pushes delay. That is why this is the service we split.

---

## 7. Data

### 7.1 PostgreSQL (source of truth)

Logical model: [`02-er-diagram.md`](02-er-diagram.md).

```mermaid
flowchart TB
    PG[(PostgreSQL)]
    PG --- U[users, profiles, devices, refresh_tokens]
    PG --- CAL[packages, availability_slots]
    PG --- B[bookings, payments, reviews]
    PG --- C[conversations, messages]
    PG --- M[wallets, ledger_entries]
    PG --- N[notifications]
```

Both services may use the **same RDS instance**. Notify should only **write** `notifications` (and read `devices` for push tokens). No shared Prisma writes into `bookings`.

Indexes that matter at 100k accounts: `users.email`, slots `(trainerId, startsAt)`, bookings `(clientId,status)` / `(trainerId,status)`, messages `(conversationId, createdAt)`, notifications `(userId, createdAt)`.

### 7.2 Redis

| Key / structure | Use |
|---|---|
| Refresh denylist / jti | Logout before access TTL ends |
| `slot:hold:{slotId}` | Checkout hold + TTL |
| Presence | Socket online |
| Unread counters | Chat badge |
| Queue | Events for notify (if not SQS) |
| Socket.io adapter | Multi-task chat |

### 7.3 S3

Objects only. DB stores URL/key. Kinds: `AVATAR`, `GALLERY`, `CERT`, `CHAT`.

---

## 8. Auth (inside core)

```mermaid
sequenceDiagram
    participant App
    participant LB
    participant Core
    participant DB
    participant Redis

    App->>LB: POST /v1/auth/login
    LB->>Core: same
    Core->>DB: User + password hash
    Core->>Core: Sign access JWT 15m
    Core->>DB: Store hashed refresh 30d
    Core-->>App: access + refresh

    App->>LB: GET /v1/bookings Authorization Bearer
    LB->>Core: JWT guard
    Core->>Core: Verify signature locally
    opt Denylist
        Core->>Redis: Access jti revoked?
    end
    Core-->>App: 200
```

Roles: `CLIENT` | `TRAINER` | `ADMIN`. Guards on every non-public route. Google/Apple: spec only after email.

Notify HTTP uses the **same** access JWT (same secret). No auth service round-trip.

---

## 9. Matching (discover)

Weighted overlap, not ML. Weights in [`00-decisions.md`](00-decisions.md). Runs in core, SQL/Prisma + in-process score. Cache later if hot (`discover:{clientId}` TTL). Distance optional until GPS exists.

---

## 10. Calendar, booking, money

State machines: [`04-state-machines.md`](04-state-machines.md). Sequences: [`08-sequences.md`](08-sequences.md).

```mermaid
stateDiagram-v2
  [*] --> OPEN
  OPEN --> HELD: checkout start
  HELD --> OPEN: expire / fail
  HELD --> BOOKED: PaymentIntent authorized
  BOOKED --> OPEN: decline / cancel
  OPEN --> CANCELLED: trainer removes
```

```mermaid
sequenceDiagram
    participant Client
    participant Core
    participant DB
    participant Stripe
    participant Q as Queue

    Client->>Core: POST /v1/bookings
    Core->>DB: BEGIN
    Core->>DB: Slot OPEN → HELD
    Core->>Stripe: PaymentIntent authorize
    Core->>DB: Booking PENDING_ACCEPTANCE
    Core->>DB: COMMIT
    Core->>Q: booking.requested
    Core-->>Client: booking + clientSecret

    Note over Client,Stripe: Client confirms card with Stripe SDK

    participant Trainer
    Trainer->>Core: POST /v1/bookings/id/accept
    Core->>Stripe: Capture
    Core->>DB: CONFIRMED, slot BOOKED, wallet pending
    Core->>Q: booking.confirmed
```

**Concurrency:** one slot, two clients → transaction + row lock (or `UPDATE … WHERE status = OPEN`). Second gets `SLOT_NOT_OPEN`.

**Money:** Stripe webhook is source of truth for capture/cancel/refund. Ledger: pending on accept, **available on COMPLETED**. Fee 10% as in decisions. Connect payouts later; withdraw stub OK.

Idempotency: Stripe `event.id` stored; duplicate webhooks no-op.

---

## 11. Chat

REST for history; Socket.io for live. Same core process.

```mermaid
flowchart LR
    A[App A] -->|WSS| LB
    B[App B] -->|WSS| LB
    LB --> C1[Core task 1]
    LB --> C2[Core task 2]
    C1 --> Redis[(Redis adapter)]
    C2 --> Redis
    C1 --> PG[(messages)]
    C2 --> PG
```

Allowed if accepted request **or** non-declined booking. Events: `message:new`, `message:typing`, `presence:update`. Image: upload file then send URL. On persist → queue `message.created` for push if recipient offline.

---

## 12. Trust, security, public surface

```mermaid
flowchart LR
    subgraph public [Internet]
        apps[Apps]
        stripe[Stripe webhooks]
    end

    subgraph vpc [VPC]
        alb[ALB]
        core[Core]
        notify[Notify]
        pg[(RDS)]
        redis[(Redis)]
    end

    apps -->|TLS + JWT| alb
    stripe -->|Signature| alb
    alb --> core
    alb --> notify
    core --> pg
    core --> redis
    notify --> pg
    notify --> redis
```

| Rule | How |
|---|---|
| Secrets | Env / Secrets Manager, never git |
| Passwords | bcrypt (or argon2) |
| Refresh | Hashed at rest, rotate on use |
| Webhook | Stripe signature + raw body |
| HTTP | Helmet, CORS allowlist, rate limit |
| Files | Auth + `kind` + size/mime limits |
| PII | UTC in DB; apps convert timezone |

Public: register/login/refresh/forgot-reset, Stripe webhook. Else JWT + role.

---

## 13. Observability and health

| Signal | Design |
|---|---|
| Logs | JSON, `request-id` (ALB/`x-request-id` in, or generate) |
| Metrics later | RPS, latency, 5xx, queue depth, DB connections |
| Trace later | Same `request-id` on core → queue → notify |
| `/health` | Process up (LB liveness) |
| `/ready` | Postgres (+ Redis) reachable |
| Alarms | 5xx, unhealthy ECS, RDS CPU/connections, queue age |

Notify worker failures → retry + dead-letter; do not fail the core HTTP call.

---

## 14. CI / CD

```mermaid
flowchart LR
    PR[Pull request] --> CI[Lint test build]
    CI --> OK{Green?}
    OK -->|no| BLOCK[No merge]
    OK -->|yes| MERGE[Merge to main]
    MERGE --> IMG[Build images core + notify]
    IMG --> ECR[Push ECR]
    ECR --> ECS[Deploy Fargate]
    ECS --> H[Health / ready]
    H -->|fail| RB[Rollback previous task def]
```

- PR: lint, unit/integration, `nest build`. No heavy k6 on every PR.
- `main` only: images → ECS rolling → health.
- Staging then production when AWS exists.

---

## 15. Testing

```mermaid
flowchart TB
    U[Unit: match, fee, slot rules]
    I[Integration: auth, booking tx, webhook]
    K[k6: 3–5 journeys]
    U --> I --> K
```

k6 examples (small, after flows exist): login+refresh, discover list, create booking (test Stripe), optional chat connect. Hits **ALB/Nginx**, not K8s.

---

## 16. Capacity (~100k registered)

Assumptions to revisit with k6: DAU ≪ registered; concurrent often hundreds–low thousands, not 100k.

| Layer | How it scales |
|---|---|
| Core | Stateless + JWT → more ECS tasks behind ALB |
| Chat | Redis adapter; connection count is the hot spot |
| Notify | Scale workers independently of HTTP |
| Postgres | Indexes, pooling (Prisma + RDS Proxy later), replica if read-heavy |
| Redis | Holds + presence; eviction policy explicit |
| Slot book | DB lock, not “hope” |

Vertical first (task size / RDS class), then horizontal core + notify. Read replica / partition only after k6 shows a real bottleneck.

---

## 17. Failure modes

| Failure | User sees | Design |
|---|---|---|
| Core down | App down | Multi-AZ later; ALB unhealthy drain |
| Notify down | App works; no push | Queue backs up, worker catch-up |
| Redis down | Holds/presence degrade | Auth refresh still in Postgres; document degraded mode |
| RDS down | App down | Backups; Multi-AZ when prod |
| Stripe down | Bookings cannot pay | Clear error; no fake CONFIRMED |
| One core task dies | Sockets on that task drop | Redis adapter + client reconnect |

---

## 18. Environments

| | Local | Staging | Production |
|---|---|---|---|
| Edge | Nginx or direct `:3000` | ALB + TLS | ALB + TLS + WSS |
| Core / notify | Compose | ECS | ECS |
| DB / Redis | Compose | RDS + ElastiCache small | RDS + ElastiCache sized from k6 |
| Stripe | Test keys | Test | Live |
| Push | Optional log-only | Sandbox certs | Live |

---

## 19. Build vs design (when things appear)

Design is true **now**. Code follows [`00-decisions.md`](00-decisions.md) order: domain in core first (auth already started) → notify extract + Nginx/ALB when there is something to notify → k6 → AWS.

Portable for a future K8s phase: **stateless process, env config, Docker, `/health` `/ready`**. No Kubernetes API in Nest.

---

## 20. Related docs

| Doc | What |
|---|---|
| [00-decisions.md](00-decisions.md) | Locked choices |
| [01-prd-mvp.md](01-prd-mvp.md) | Screens / cut |
| [02-er-diagram.md](02-er-diagram.md) | Tables |
| [04-state-machines.md](04-state-machines.md) | Booking / slot / money |
| [05-api-contract.md](05-api-contract.md) | REST |
| [06-architecture.md](06-architecture.md) | Short client view |
| [07-user-flows.md](07-user-flows.md) | Journeys |
| [08-sequences.md](08-sequences.md) | Time-ordered API |
| [09-domain-states.md](09-domain-states.md) | Visual states / gantt |
