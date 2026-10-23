# Session

Signed httpOnly cookie via `iron-session` (`src/session/cookie.ts`).

## Contents

- `stage`: Discover | Pipeline | Booking | Service
- CRM ids: `leadId`, `dealId`, `bookingId`, `contactId`
- Slots: `phone`, `name`, `email`, `city`, `vehicle`, `demoDate`, `demoTime`, `pendingSlots`
- `messages`: last ~20 chat turns (UI message shape)

## Cookie

- Name: `oem-chat-session`
- Password: `SESSION_SECRET` (must be ≥32 characters)
- `httpOnly`, `sameSite=lax`, `secure` in production
- TTL: 14 days

## Accounts

MongoDB (`MONGODB_URI`, database `MONGODB_DB` or `mahindra`) stores accounts: name, email, and a scrypt password hash. The signed `oem-user` cookie stores only the user id.

Sign-in copies that name and email onto this chat session so the bot can use them. Demo date/time (`demoDate`, `demoTime`) live only on the chat cookie for the current session (and on the CRM lead when `createLead` runs). They are **not** stored on the MongoDB user. **New chat** clears the thread, CRM slots, and demo schedule; the account (name/email) stays.

## APIs

- `POST /api/auth/register` and `POST /api/auth/login` — create or verify an account, then set the user cookie and chat identity
- `POST /api/auth/logout` — clears the user cookie and the chat session
- `POST /api/chat` — requires a signed-in user; reads session, runs agent, writes stage/slots/messages
- `GET /api/session` — returns stage and non-sensitive slots for the stage badge
- `POST /api/session` with `{ "action": "reset" }` — clears CRM slots, keeps the account

## UI

- **New chat** — clears the thread and CRM slots. The signed-in name and email stay.
- **Sign out** — ends the account session and the chat cookie.
- Reset **deletes** phone/name/email/CRM ids (not only overwrites `stage`). Reload after reset if the badge still looks stale.

No Redis. State survives refresh because it lives on the cookie.
