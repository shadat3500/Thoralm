# Docs index

Preview these files in Cursor or GitHub — Mermaid diagrams render in the markdown preview.

| File | What |
|---|---|
| [00-decisions.md](00-decisions.md) | Locked product + stack choices |
| [01-prd-mvp.md](01-prd-mvp.md) | MVP screens and cut line |
| [02-er-diagram.md](02-er-diagram.md) | Tables and relations |
| [03-enums.md](03-enums.md) | Figma to DB values |
| [04-state-machines.md](04-state-machines.md) | Booking, slot, request, money (text) |
| [05-api-contract.md](05-api-contract.md) | REST endpoints |
| [06-architecture.md](06-architecture.md) | Short system + container + module diagrams |
| [07-user-flows.md](07-user-flows.md) | Client / trainer journeys, matching, book |
| [08-sequences.md](08-sequences.md) | Auth, book+pay, chat, Stripe sequences |
| [09-domain-states.md](09-domain-states.md) | ER visual, state machines, MVP gantt |
| [10-system-design.md](10-system-design.md) | Full system design (LB, AWS, notify, scale, CI, tests) |
| [11-module-playbook.md](11-module-playbook.md) | How to finish a module (reuse for 3+) |

**Show a client these four first:** `06` architecture, `07` flows, `08` sequences, `09` states. Engineers: `10` system design.

Code currently implements:

1. **Auth + users** — register, login, refresh, logout, forgot/reset password, `GET/PATCH/DELETE /me`, change password, register device
2. **Profiles + onboarding** — `GET /onboarding`, `PATCH /onboarding/client|trainer`, `POST /onboarding/complete`, `POST /files`

Postman: [`postman/Moveitz-Modules-1-2.postman_collection.json`](../postman/Moveitz-Modules-1-2.postman_collection.json)
