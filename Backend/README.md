# Moveitz API

Marketplace backend for the client and trainer apps. Stage 0 docs live in [`docs/`](docs/). Product name: **Moveitz**.

## Stack

NestJS · Prisma · PostgreSQL · Redis · JWT · Socket.io (chat later)

One **core** API now. **Notifications** become a separate service later (see `docs/00-decisions.md` and `docs/10-system-design.md`).

## Run locally

1. Copy env: `copy .env.example .env` (Windows) or `cp .env.example .env`
2. Start DB + Redis: `docker compose up -d`
3. Install: `npm install`
4. Schema: `npx prisma migrate dev`
5. API: `npm run start:dev`
6. Swagger: http://localhost:3000/docs
7. Health: http://localhost:3000/health · Ready: http://localhost:3000/ready
8. Postman: import `postman/Moveitz-Modules-1-2.postman_collection.json`

API prefix: `/v1` (health/ready are unprefixed for the load balancer)

Implemented: **module 1** (auth + users) and **module 2** (profiles + onboarding + file upload). Playbook: `docs/11-module-playbook.md`. Tests: `npm test` (unit) and `npm run test:e2e` (needs Docker Postgres + Redis).

If you previously ran the old `thoralm` compose volume, recreate: `docker compose down -v` then `docker compose up -d` (wipes local DB).

## Build order

Auth → onboarding/profiles → discover → slots/bookings → chat → payments → notification service + load balancer

See `docs/00-decisions.md`.
