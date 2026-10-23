# Mahindra OEM chat agent (assessment demo)

Four-stage automotive chat agent: **Discover → Pipeline → Booking → Service**.  
Groq primary, Gemini fallback. Zoho CRM behind a swappable client (mock until credentials exist).

> Demo in an OEM voice (XUV700, Thar, Scorpio-N). Not an official Mahindra product.

## Quick start

```bash
cp .env.example .env.local
# fill GROQ_API_KEY, SESSION_SECRET (npm run secret)
# optional: GOOGLE_GENERATIVE_AI_API_KEY for fallback
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Default `CRM_MODE=mock`.

## Docs

- [Architecture](docs/architecture.md)
- [Stages](docs/stages.md)
- [Session](docs/session.md)
- [Zoho setup](docs/zoho-setup.md)
- [Deploy on Google Cloud (Cloud Run)](docs/deploy-gcp.md)

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run secret` | Generate `SESSION_SECRET` |
| `npm run seed:zoho` | Seed Zoho from `scripts/seed_data.json` |
| `npm run secrets:check` | Block env files + secret pattern scan (also pre-commit) |
| `npm run audit:check` | Production dependency CVE audit, high+ (also pre-commit) |

## Mock seeds

| Person | Use |
|---|---|
| Rajesh Sharma `+919800000001` | Discover / existing lead |
| Priya Patel `+919800000002` | Pipeline deal (XUV700) |
| Amit Verma / `MAH-9921` | Booking In Transit |
| Sunil Rao / `MH04 AB 1234` | Service owner |

## Security

- Never commit `.env` / `.env.local`. Husky + secretlint run on commit.
- No `NEXT_PUBLIC_` for LLM or Zoho keys.
- `CRM_MODE=mock` is refused in production.
