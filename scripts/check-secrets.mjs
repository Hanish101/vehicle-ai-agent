#!/usr/bin/env node
/**
 * Pre-commit / CI gate:
 * 1) Refuse staged .env files other than .env.example
 * 2) Scan staged (or listed) files for common secret patterns
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename } from "node:path";

const ENV_BLOCK = /^\.env(\..+)?$/;
const ENV_ALLOW = new Set([".env.example"]);
const MAX_BYTES = 1_500_000;

const PATTERNS = [
  {
    name: "Private key block",
    re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  },
  {
    name: "Google API key",
    re: /\bAIza[0-9A-Za-z_-]{20,}\b/,
  },
  {
    name: "Groq API key",
    re: /\bgsk_[A-Za-z0-9]{20,}\b/,
  },
  {
    name: "OpenAI-style key",
    re: /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/,
  },
  {
    name: "AWS access key id",
    re: /\bAKIA[0-9A-Z]{16}\b/,
  },
  {
    name: "MongoDB connection string with credentials",
    re: /mongodb(?:\+srv)?:\/\/[^\s'"]+:[^\s'"]+@/i,
  },
  {
    name: "Assigned secret env value",
    re: /\b(?:GOOGLE_GENERATIVE_AI_API_KEY|GROQ_API_KEY|OPENROUTER_API_KEY|SESSION_SECRET|ZOHO_CLIENT_SECRET|ZOHO_REFRESH_TOKEN|ZOHO_CLIENT_ID)\s*[:=]\s*['"]?[^\s'"]{12,}/,
  },
];

const SKIP_NAMES = new Set([
  "package-lock.json",
  "check-secrets.mjs",
  "gen_session_secret.mjs",
  ".secretlintrc.json",
]);

function stagedFiles() {
  try {
    const out = execSync("git diff --cached --name-only --diff-filter=ACM", {
      encoding: "utf8",
    });
    return out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function shouldScan(path) {
  const base = basename(path);
  if (SKIP_NAMES.has(base)) return false;
  if (ENV_ALLOW.has(base) || ENV_ALLOW.has(path)) return false;
  if (/\.(png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|map)$/i.test(path)) {
    return false;
  }
  try {
    if (!statSync(path).isFile()) return false;
    if (statSync(path).size > MAX_BYTES) return false;
  } catch {
    return false;
  }
  return true;
}

const args = process.argv.slice(2);
const files = (args.length ? args : stagedFiles()).filter((f) => existsSync(f));

const blocked = files.filter((f) => ENV_BLOCK.test(f) && !ENV_ALLOW.has(f));
if (blocked.length) {
  console.error("Refusing to commit env files that may contain secrets:");
  for (const f of blocked) console.error(`  - ${f}`);
  console.error("Only .env.example (blank template) may be committed.");
  process.exit(1);
}

let findings = 0;
for (const file of files.filter(shouldScan)) {
  let content;
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  // Skip binary-ish content
  if (content.includes("\u0000")) continue;

  for (const { name, re } of PATTERNS) {
    if (re.test(content)) {
      findings += 1;
      console.error(`Secret-like content (${name}) in ${file}`);
    }
  }
}

if (findings) {
  console.error(
    `\nBlocked ${findings} potential secret(s). Remove secrets and keep blanks in .env.example.`,
  );
  process.exit(1);
}

process.exit(0);
