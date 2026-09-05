# Locked decisions (stage 0)

These are product/engineering defaults for Moveitz. Change here first, then code.

## Product

| Decision | Choice |
|---|---|
| App name (working) | Moveitz |
| Model | Marketplace: clients book trainers |
| Clients | Two mobile apps (client + trainer), one backend |
| Market (MVP) | Single country, English UI copy, money in USD |
| Time | Store UTC, send ISO-8601, client converts to local |
| Out of scope (UI red-X) | Client budget screen, “when should training happen” |

## Location

- Saved on **onboarding / profile**, not register. Static pin (search or current location), not live tracking.
- App + Google Maps; API stores `lat`, `lng`, optional `addressText`.
- Clients see trainer pins; trainers see client pins. Trainer matching stays accept/decline (no client swipe).
- Discover later sorts by distance using these coords.

## Booking model

Trainer publishes **available slots**. Client picks package + slot and pays.

```
client pays (authorize) → booking = pending_acceptance
trainer accepts          → payment captured → confirmed
trainer declines / timeout → payment released → declined
session time passes      → completed
```

First-time match from Discover can also create a **client request** (Accept / Decline). After accept, that client can book the trainer’s slots.

## Money

- Platform fee: **10%** (matches trainer “Add slot” UI)
- Client pays: session price + fee
- Trainer earns: session price − fee (i.e. 90% of listed session price, fee added on client side — see payment spec)
- Provider: **Stripe** (Connect for trainer payouts later)
- MVP: charge client, record ledger; **withdraw/payout can be stubbed**

Fee math (UI):

- Gross = price_per_session × sessions
- Platform fee = 10% of gross
- Client pay = gross + fee
- Trainer earn = gross − fee

## Matching

Weighted overlap, not ML.

| Signal | Weight |
|---|---|
| Shared goals / specialties | 30 |
| Training location overlap | 20 |
| Coach style overlap | 15 |
| Language overlap | 15 |
| Experience vs client level | 10 |
| Special needs vs trainer tags | 10 |

Return `matchPercent` 0–100. Discover list is trainers above a threshold, sorted by score then distance (distance optional in MVP if no GPS).

## Chat

Own **Socket.io** on the same API. MVP: text + image. Later: voice, call.

## Auth

- Email + password (MVP)
- JWT access (15m) + refresh (30d)
- Google / Apple: spec only, implement after email auth
- Roles: `CLIENT`, `TRAINER`, `ADMIN`

## Stack

| Layer | Choice |
|---|---|
| API | NestJS + TypeScript |
| ORM / DB | Prisma + PostgreSQL |
| Cache / sessions | Redis (refresh denylist, online presence, unread, slot holds) |
| Files | S3-compatible (profile, gallery, certs, chat images) |
| Realtime | Socket.io (Redis adapter when more than one API instance) |
| Push / mail | FCM + APNs + email — **notification service** (not the core request path) |
| Docs | OpenAPI via `@nestjs/swagger` |

## Scale, services, cloud (locked)

Target: **~100k registered users** (not 100k concurrent). Product requirements may still grow a little (calendar + messaging are already in spec).

| Decision | Choice |
|---|---|
| Default shape | Modular monolith (**core API**) |
| One microservice | **Notifications only** (HTTP + queue worker) |
| Auth | Stays a Nest **module inside core** — not a separate service |
| Load balancer | Local **Nginx**; AWS **ALB** (path: `/v1/notifications` → notify, rest → core) |
| Compute (AWS) | **ECS Fargate** (two services) |
| Kubernetes | **Not now** (local `kind` / EKS can be a later phase) |
| Queue | Redis/BullMQ or SQS — core publishes events, notify consumes |
| IaC | Terraform when AWS is wired; not click-ops for prod |

Mobile talks to **one URL**. It does not know there are two services.

## Testing (locked)

| Kind | Do we? | Size / when |
|---|---|---|
| Unit | Yes | Domain logic (match %, fees, slot rules) — with each module |
| Integration | Yes | Auth, booking transactions, webhooks — critical flows |
| k6 load | Yes | Small: ~3–5 journey scripts, not 1:2 with app code. After flows exist, not every PR |
| K8s as a test tool | No | k6 hits the load balancer / API; K8s is not required to load-test |

## Use / do not use

**Use**

- NestJS modules, Prisma, PostgreSQL, Redis, JWT access+refresh, RBAC
- Socket.io, Stripe **authorize → capture**
- Docker Compose locally (core, notify, Postgres, Redis, Nginx)
- ALB + ECS + RDS + ElastiCache + S3 + SES + Secrets Manager on AWS
- CI: PR lint/test/build. CD: `main` only → image registry → deploy → health check
- Structured logs + `request-id`; `/health` and `/ready`
- Helmet, rate limit, env validation, no secrets in git

**Do not use (this project, this stage)**

- Kubernetes / EKS for now (reopen later if we want; **app code does not depend on K8s**)
- Auth as a microservice; a second/third domain service (chat, pay, matching)
- MongoDB, GraphQL, Kafka, full event-sourcing / CQRS
- Google/Apple OAuth before email auth works
- Force-push, skip-hooks, secrets in the repo

## Build order

1. Auth + users
2. Profiles + onboarding
3. Discover / matching
4. Slots + bookings (calendar)
5. Chat (messaging)
6. Payments
7. Notifications as **separate service** + load balancer (after there is something to notify)
8. Reviews / wallet polish
9. k6 against critical journeys; AWS wiring when the two services are stable
