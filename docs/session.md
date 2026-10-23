# Session

Signed httpOnly cookie via `iron-session` (`src/session/cookie.ts`).

## Contents

- `stage`: Discover | Pipeline | Booking | Service
- CRM ids: `leadId`, `dealId`, `bookingId`, `contactId`
- Slots: `phone`, `name`, `email`, `city`, `vehicle`, `pendingSlots`
- `messages`: last ~20 chat turns (UI message shape)

## Cookie

- Name: `oem-chat-session`
- Password: `SESSION_SECRET` (must be ≥32 characters)
- `httpOnly`, `sameSite=lax`, `secure` in production
- TTL: 14 days

## APIs

- `POST /api/chat` — reads session, runs agent, writes stage/slots/messages
- `GET /api/session` — returns stage and non-sensitive slots for the stage badge
- `POST /api/session` with `{ "action": "reset" }` — clears session

## UI

- **New chat** — clears the thread and resets the cookie (stage + slots).
- Reset **deletes** phone/name/email/CRM ids (not only overwrites `stage`). Reload after reset if the badge still looks stale.

No Redis. State survives refresh because it lives on the cookie.
