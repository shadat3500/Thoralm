# Module playbook

Use this for **every** domain slice (auth is module 1, onboarding/files is 2, discover is 3, …). Do not skip steps because the next module is more interesting.

## Flow

1. **Contract** — `docs/05-api-contract.md` (and sequences in `08` if any). No new path without a row there.
2. **States / rules** — who can call it, which error code (`EMAIL_TAKEN`, `FORBIDDEN_ROLE`, `ONBOARDING_INCOMPLETE`, …).
3. **Implement** — Nest module, DTO + `class-validator`, `ApiError` for domain failures, Prisma transaction when two writes must succeed together.
4. **Harden** — JWT + role if not public; do not trust the client for `role` on sensitive paths; revoke sessions when password changes.
5. **Prove** — unit for pure rules; e2e (`npm run test:e2e`) for the HTTP path against local Postgres + Redis.
6. **Manual** — Swagger `/docs` + Postman collection for that module.
7. **Stop** — next module only when e2e for this one is green.

## Done means

- Matches the contract (status + `{ statusCode, error, message }` on failure)
- Happy path + one rejection path tested
- No secrets in git; env via Joi
- Does not require a new microservice (only notifications will, later)

## Module map

| # | Slice | Code |
|---|---|---|
| 1 | Auth + users | `src/auth/` |
| 2 | Onboarding + files | `src/onboarding/`, `src/files/` |
| 3 | Discover / matching | not started |
