# Host on Google Cloud (Cloud Run)

Recommended path for this Next.js App Router app: **Cloud Run** (container). Do not use `CRM_MODE=mock` in production — the app refuses it.

## Prerequisites

- Google Cloud project with billing enabled
- `gcloud` CLI installed and logged in
- Docker (or Cloud Build)
- Zoho + LLM keys ready (same as `.env.example`)

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
```

## 1. Create an Artifact Registry repo

```bash
gcloud artifacts repositories create oem-chat \
  --repository-format=docker \
  --location=asia-south1 \
  --description="OEM chat agent"
```

## 2. Build and push the image

From the repo root (uses [Dockerfile](../Dockerfile)):

```bash
export PROJECT_ID=$(gcloud config get-value project)
export REGION=asia-south1
export IMAGE=${REGION}-docker.pkg.dev/${PROJECT_ID}/oem-chat/mahindra-ai-agent:latest

gcloud builds submit --tag "$IMAGE"
```

## 3. Create a strong session secret

```bash
openssl rand -base64 48
```

## 4. Deploy to Cloud Run

Set secrets as env vars (prefer [Secret Manager](https://cloud.google.com/secret-manager) for anything long-lived). Minimum:

| Env | Notes |
|---|---|
| `CRM_MODE` | `zoho` (required in production) |
| `SESSION_SECRET` | ≥32 chars |
| `GROQ_API_KEY` | Primary LLM |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional fallback |
| `ZOHO_CLIENT_ID` / `ZOHO_CLIENT_SECRET` / `ZOHO_REFRESH_TOKEN` | OAuth |
| `ZOHO_API_DOMAIN` | e.g. `https://www.zohoapis.in` |
| `ZOHO_ACCOUNTS_DOMAIN` | e.g. `https://accounts.zoho.in` |
| `ZOHO_VEHICLE_FIELD` | default `Vehicle_Model` |

```bash
gcloud run deploy mahindra-ai-agent \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "CRM_MODE=zoho,ZOHO_API_DOMAIN=https://www.zohoapis.in,ZOHO_ACCOUNTS_DOMAIN=https://accounts.zoho.in,ZOHO_VEHICLE_FIELD=Vehicle_Model"
```

Then attach the secret env names from the table above via Secret Manager / Cloud Run console
(`--set-secrets`), or `gcloud run services update` with env vars. Do not commit real values.

Open the service URL printed by the deploy command.

## 5. After deploy

1. Seed Zoho once from a trusted machine: `CRM_MODE=zoho` + keys in local `.env` → `npm run seed:zoho`.
2. Confirm custom Lead/Deal fields are on the Zoho layout (`Vehicle_Model`, `Preferred_City`, booking fields).
3. Smoke-test all four stages on the Cloud Run URL; use **Reset session** between scenarios.

## Security notes

- Chat has **no login**. Anyone with the URL can create Leads/Cases in your Zoho org. Prefer `--no-allow-unauthenticated` plus IAP / identity, or keep the URL private for the assessment demo only.
- Never bake `.env` into the image (`.dockerignore` excludes it).
- In-memory rate limits reset per instance; fine for a demo, not multi-user production hardening.

## Alternatives (same codebase)

| Option | When |
|---|---|
| **Cloud Run** (this doc) | Default for Next.js + secrets |
| **Firebase App Hosting** | If you already use Firebase and want managed Next.js |
| **GCE VM + Docker** | Only if you need a long-lived VM |

App Engine standard is a poor fit for this stack; use Cloud Run.
