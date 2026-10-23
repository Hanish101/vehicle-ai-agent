// Ping the same Gemini and Groq models the agent uses (src/agent/model.ts).
// Reads keys from .env.local then .env. Never prints key values.
// Usage: npm run llm:check
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

// Keep in sync with src/agent/model.ts
const GEMINI_MODEL = "gemini-3.5-flash";
const GROQ_MODEL = "openai/gpt-oss-120b";
const OPENROUTER_MODEL_DEFAULT = "meta-llama/llama-3.3-70b-instruct";
const TIMEOUT_MS = 20_000;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

function redact(text, secrets) {
  let out = String(text ?? "");
  for (const secret of secrets) {
    if (secret && secret.length > 6) out = out.split(secret).join("[redacted]");
  }
  return out.replace(/\s+/g, " ").slice(0, 400);
}

async function request(url, options, secrets) {
  const res = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    json = null;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}: ${redact(body, secrets)}`);
    err.status = res.status;
    err.json = json;
    throw err;
  }
  return json;
}

async function checkGoogle(apiKey) {
  const json = await request(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: "Reply with the single word OK." }] },
        ],
        generationConfig: { maxOutputTokens: 256 },
      }),
    },
    [apiKey],
  );
  const candidate = json?.candidates?.[0];
  const text = candidate?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();
  const finish =
    candidate?.finishReason ?? json?.promptFeedback?.blockReason ?? "unknown";
  if (!text) {
    throw new Error(`HTTP 200 but empty text (finish=${finish})`);
  }
  return { model: GEMINI_MODEL, text, finish };
}

async function checkGroq(apiKey) {
  try {
    const json = await request(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: "user", content: "Reply with the single word OK." },
          ],
          max_tokens: 256,
          reasoning_effort: "low",
        }),
      },
      [apiKey],
    );
    const choice = json?.choices?.[0];
    const text = choice?.message?.content?.trim();
    if (!text) {
      throw new Error(
        `HTTP 200 but empty text (finish=${choice?.finish_reason ?? "unknown"})`,
      );
    }
    return { model: GROQ_MODEL, text };
  } catch (err) {
    if (err.status !== 404) throw err;
    const listed = await request(
      "https://api.groq.com/openai/v1/models",
      { headers: { authorization: `Bearer ${apiKey}` } },
      [apiKey],
    );
    const ids = (listed?.data ?? [])
      .map((row) => row.id)
      .filter(Boolean)
      .sort();
    throw new Error(
      `Key accepted, but ${GROQ_MODEL} is not available. Models on this key: ${ids.join(", ") || "(none)"}`,
    );
  }
}

async function checkOpenRouter(apiKey) {
  const model =
    process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODEL_DEFAULT;
  const json = await request(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word OK." }],
        max_tokens: 64,
      }),
    },
    [apiKey],
  );
  const choice = json?.choices?.[0];
  const text = choice?.message?.content?.trim();
  if (!text) {
    throw new Error(
      `HTTP 200 but empty text (finish=${choice?.finish_reason ?? "unknown"})`,
    );
  }
  return { model, text };
}

async function run(name, envName, fn) {
  const apiKey = process.env[envName];
  if (!apiKey) {
    console.log(`${name}: SKIP — ${envName} is not set`);
    return false;
  }
  try {
    const result = await fn(apiKey);
    console.log(
      `${name}: OK (${result.model}) reply="${redact(result.text, [apiKey])}"`,
    );
    return true;
  } catch (err) {
    const message =
      err?.name === "TimeoutError"
        ? `timed out after ${TIMEOUT_MS}ms`
        : (err?.message ?? err);
    console.log(`${name}: FAIL — ${redact(message, [apiKey])}`);
    return false;
  }
}

const groqOk = await run("Groq", "GROQ_API_KEY", checkGroq);
const openRouterOk = await run(
  "OpenRouter",
  "OPENROUTER_API_KEY",
  checkOpenRouter,
);
const googleOk = await run(
  "Google Gemini",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  checkGoogle,
);

// Exit 0 if any configured provider works (order matches resolveModel).
if (groqOk || openRouterOk || googleOk) {
  process.exitCode = 0;
} else {
  process.exitCode = 1;
}
