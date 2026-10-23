# Handoff status — Mahindra multistage AI chat agent

Use this file when continuing in a new Cursor chat opened on **`mahindra-ai-agent`**.

Plan reference (do not edit the plan file unless asked):  
`~/.cursor/plans/oem_chat_agent_eaa76640.plan.md`

---

## Done so far

| Item | Status |
|---|---|
| Next.js 16 App Router + TypeScript + Tailwind scaffold | Done |
| Dependencies: `ai`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/react`, `zod`, `iron-session` | Done |
| Cursor rules (`.cursor/rules/`) + AGENTS.md project note | Done |
| Husky + secrets:check (env block + pattern scan) | Done |
| Docs (`docs/*.md`) + README | Done |
| Session cookie + CRM port (mock + Zoho) | Done |
| Agent (stages, tools, Groq→Gemini fallback) + `/api/chat` | Done |
| Chat UI with stage badge | Done |
| Mock lifecycle verify (Discover / Pipeline / Booking / Service) | Done via API + browser (MAH-9921) |
| Live Zoho verification | Optional — when you want to test `CRM_MODE=zoho` |

---

## Decisions locked

- Single Next.js deploy.
- Chat only.
- LLM: **Groq primary**, **Gemini secondary** fallback.
- CRM: mock until Zoho; refuse `CRM_MODE=mock` in production.
- Session: signed httpOnly cookie (`iron-session`).
- Four stages: Discover → Pipeline → Booking → Service.
- Secrets: never commit `.env*`; pre-commit blocks them.

---

## How to run

```bash
cp .env.example .env.local   # or use existing .env
npm install
npm run secret               # if SESSION_SECRET missing
npm run dev
```

Mock seeds: Rajesh / Priya (`…0002`) / `MAH-9921` / Sunil (`MH04 AB 1234`).
