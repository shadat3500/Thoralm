# Moveitz MVP PRD

Source of truth for what the backend must support from the Figma screens (`extra/client/` and `extra/trainer/` screenshots).

## Users

Two roles, one account system. Role is chosen at signup and cannot be switched in MVP.

### Client

Wants a trainer. Bottom nav: Home, Discover, Bookings, Chat, Profile.

### Trainer

Wants clients. Bottom nav: Home, Clients, Schedule, Chat, Profile.

---

## MVP features

### Shared

- Register (name, email, phone, password)
- Login / logout / refresh token
- Forgot password (email link)
- Upload profile photo
- Multi-step onboarding (progress saved; can resume)
- Push + in-app notifications (booking, chat, request)
- Account: edit profile, change password, notification toggles, delete account
- Legal: Terms + Privacy URLs only (CMS later)

### Client onboarding

Order from UI. Skip-not-allowed except photo (optional).

1. Role = Client
2. Name, email, password
3. Profile photo (optional)
4. Gender
5. Age
6. Weight (kg; store kg only, convert on client if lb)
7. Height (cm)
8. Goal (multi)
9. Experience: beginner / intermediate / advanced
10. Where to train: gym / home / outdoor
11. Frequency
12. Coach style
13. Special needs (multi, optional)
14. Preferred language
15. Trainer gender preference
16. Matching loading screen → Discover

**Not in MVP:** budget, preferred training clock times (red-X in Figma).

### Trainer onboarding

1. Role = Trainer
2. Name, email, phone, password
3. Profile photo
4. Gender
5. Specializations (multi)
6. Years of experience (band)
7. Training locations (multi, includes online)
8. Sessions per week capacity
9. Rate band (used as default; exact `$` set later in packages)
10. Coaching style
11. Languages
12. Certifications (image/PDF upload, status `pending`)
13. Matching / “go to home”

### Client app

| Screen | Backend must provide |
|---|---|
| Home | Greeting, next session, recommended / nearby / top-rated trainers |
| Discover | Paginated match list, like / skip, match count |
| Trainer profile | Bio, tags, certs, gallery, packages, match %, book CTA |
| Book | Packages, calendar of open slots, confirm + pay |
| Bookings | Upcoming / completed, reschedule, leave review |
| Chat | Inbox, thread, unread, images |
| Profile | Stats (sessions, trainers, streak), favorites, reviews, payments stub |
| Map | Optional later; MVP can hide or return lat/lng if present |

### Trainer app

| Screen | Backend must provide |
|---|---|
| Home | Month earnings, sessions, new clients, avg rating, today’s schedule, new requests |
| Clients | Requests (all/new/renew/archive) accept/decline; my clients + progress |
| Schedule | Week/month slots, add slot wizard (package, price, times, service type) |
| Chat | Same as client |
| Profile | Public profile fields, gallery, packages, availability |
| Wallet | Available / pending balances, transaction list; withdraw stub |

---

## Explicitly later (not MVP code)

- Google / Apple sign-in
- Voice messages, in-app call
- Map-first nearby search
- Pro Plan / subscriptions
- Analytics charts beyond simple counts
- Streak engine (can return `0`)
- Real Stripe Connect payouts
- Admin web panel (minimal `ADMIN` role in schema only)

---

## Acceptance (MVP done)

1. Client can register, finish onboarding, see matched trainers.
2. Trainer can register, finish onboarding, publish a slot.
3. Client can book that slot; trainer can accept/decline.
4. Both can chat after a confirmed booking **or** after trainer accepts a client request.
5. Completed session can be reviewed.
6. Trainer home shows earnings from captured payments (even if payout is stubbed).
