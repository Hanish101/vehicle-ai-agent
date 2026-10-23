# Zoho setup

## Env

Copy `.env.example` → `.env.local` (or `.env`). Required for live CRM:

- `CRM_MODE=zoho`
- `ZOHO_CLIENT_ID`
- `ZOHO_CLIENT_SECRET`
- `ZOHO_REFRESH_TOKEN`
- `ZOHO_API_DOMAIN` (e.g. `https://www.zohoapis.in`)
- `ZOHO_ACCOUNTS_DOMAIN` (e.g. `https://accounts.zoho.in`)
- `ZOHO_VEHICLE_FIELD` (default `Vehicle_Model`)

Also set `GROQ_API_KEY` (primary) and optionally `GOOGLE_GENERATIVE_AI_API_KEY` (fallback), plus `SESSION_SECRET` (≥32 chars). Generate with `npm run secret`.

## Self client

1. Zoho API Console → create a **Self Client**.
2. Scopes (CRM): typically `ZohoCRM.modules.ALL`, `ZohoCRM.settings.ALL` (tighten for production).
3. Generate grant token → exchange for refresh token; store refresh token in env only.

## Finding records in Zoho UI

- **Cases** (e.g. service for `MH04 AB 1234`): Zoho CRM → **Cases** module → open by Subject `Service: periodic (...)` or Case Number / id from chat.
  - **Owner** = CRM user who created the record (your Zoho login).
  - **Related To** = Contact (vehicle owner), e.g. Sunil Rao — matched by phone or registration text in Contact Description.
- **Booking MAH-9921**: Zoho CRM → **Deals** → deal name `Booking MAH-9921 - Scorpio-N Z8L` (stage Closed Won - Booking Done). Look for `VIN`, `Balance_Payment_URL`, `Allocation_Status` (add them to the Deal layout if missing).
- **Pipeline follow-up (Priya)**: Zoho CRM → **Deals** → `Priya Patel - XUV700`.
  - New date → field **`Test_Drive_Time`** (Date type, e.g. `2026-10-27`; must be on the Deal layout).
  - Clock time / “next Monday 10 am” phrase → end of **`Description`** (appended).
- Chat Case IDs like `1445820000000563001` are Zoho record ids — paste into CRM search or open Cases list sorted by Created Time.

If `Booking_ID` / `Allocation_Status` custom fields were never created, the app still finds the deal via name/word search and infers status from stage/description.

## Custom fields

Create before seeding (recommended; app has fallbacks if missing):

| Module | API name | Notes |
|---|---|---|
| Leads | `Preferred_City` | text |
| Leads / Deals | `Vehicle_Model` (or your `ZOHO_VEHICLE_FIELD`) | text |
| Deals | `Booking_ID` | text |
| Deals | `Allocation_Status` | text: In Transit / Dispatch Pending / Delivered |
| Deals | `VIN` | text (demo allocation) |
| Deals | `Balance_Payment_URL` | text / URL |
| Deals | `Test_Drive_Time` | **Date** (`YYYY-MM-DD`). Clock time is stored in Description notes. |

Deal stage for bookings: `Closed Won - Booking Done`.

## Seed

```bash
npm run seed:zoho
```

Reads `scripts/seed_data.json`. Skips existing records (by phone / deal name). Safe to re-run.

## Token manager

Access tokens cached ~55 minutes (Zoho lifetime 60). On HTTP 401: refresh once, retry once, then surface a user-facing error. No refresh loops.
