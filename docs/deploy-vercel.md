# Host on Vercel

Recommended production host for this repo. Vercel runs the Next.js App Router app (including `src/proxy.ts` auth gate and API routes). Do not use `CRM_MODE=mock` in production — the app refuses it.

## Prerequisites

- [Vercel](https://vercel.com) account linked to the Git repo
- [MongoDB Atlas](https://www.mongodb.com/atlas) (or other hosted MongoDB) for sign-in accounts
- Zoho + LLM keys (same as `.env.example`)

## 1. Import the project

1. Vercel dashboard → **Add New** → **Project** → import this repository.
2. Framework preset: **Next.js** (auto-detected).
3. Build command: `npm run build` (default).
4. Output directory: leave default (Vercel manages the build; do not set `standalone` on Vercel builds).

## 2. Environment variables

Set these in **Project → Settings → Environment Variables** for **Production** (and Preview if you want full CRM there).

| Variable | Required | Notes |
|---|---|---|
| `SESSION_SECRET` | Yes | ≥32 chars (`npm run secret`). Signs chat + user cookies |
| `MONGODB_URI` | Yes | Atlas connection string. Use **Network Access** allowlist (or `0.0.0.0/0` for a short demo only) |
| `MONGODB_DB` | No | Defaults to `mahindra` |
| `CRM_MODE` | Yes | `zoho` in production |
| `GROQ_API_KEY` | One of LLM keys | Groq (first if set) |
| `OPENROUTER_API_KEY` | One of LLM keys | [OpenRouter](https://openrouter.ai/keys) free tier; used when Groq unset |
| `OPENROUTER_MODEL` | No | Default `meta-llama/llama-3.3-70b-instruct` |
| `OPENROUTER_SITE_URL` | No | Production URL for OpenRouter rankings |
| `GOOGLE_GENERATIVE_AI_API_KEY` | No | Gemini fallback |
| `ZOHO_CLIENT_ID` | Yes (if `zoho`) | OAuth |
| `ZOHO_CLIENT_SECRET` | Yes (if `zoho`) | OAuth |
| `ZOHO_REFRESH_TOKEN` | Yes (if `zoho`) | OAuth |
| `ZOHO_API_DOMAIN` | Yes (if `zoho`) | e.g. `https://www.zohoapis.in` |
| `ZOHO_ACCOUNTS_DOMAIN` | Yes (if `zoho`) | e.g. `https://accounts.zoho.in` |
| `ZOHO_VEHICLE_FIELD` | No | Default `Vehicle_Model` |

Never commit real values. Do not use `NEXT_PUBLIC_` for any of the above.

## 3. Deploy

Push to the connected branch (or **Deploy** from the dashboard). Vercel assigns a URL like `https://your-project.vercel.app`.

Cookies use `secure: true` when `NODE_ENV=production`, so use the **HTTPS** Vercel URL.

## 4. After deploy

1. Seed Zoho once from a trusted machine: local `.env` with `CRM_MODE=zoho` → `npm run seed:zoho`.
2. Confirm Zoho Lead/Deal custom fields ([Zoho setup](zoho-setup.md)).
3. Smoke-test: sign in → **Discover** → **Pipeline** → **Booking** → **Service**. Use **New chat** between scenarios.

## Serverless notes

| Topic | Behavior on Vercel |
|---|---|
| **Auth** | `src/proxy.ts` runs on each request; `/login` and `/api/auth/*` stay public |
| **MongoDB** | `src/db/mongo.ts` reuses one client per serverless instance (not global across all regions) |
| **Rate limits** | In-memory limits in `src/lib/rate-limit.ts` are per instance; acceptable for a demo |
| **Chat session** | Signed `iron-session` cookie; size may grow with long threads (chunked cookie enabled) |

## Security

- Sign-in is required. Anyone who can **register** can still create Leads/Cases in Zoho — restrict the Vercel URL for demos or add Vercel **Deployment Protection** / allow-list.
- Rotate `SESSION_SECRET` if leaked; users must sign in again.

## Optional: self-hosted container

For Docker / Cloud Run instead of Vercel, see [Deploy on Google Cloud (Cloud Run)](deploy-gcp.md). Local builds set `output: "standalone"` when `VERCEL` is unset.
