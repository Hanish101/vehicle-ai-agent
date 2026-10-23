import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/** Keep in sync with scripts/check_llm.mjs */
export const GEMINI_MODEL = "gemini-3.5-flash";
/** Free-tier Groq keys often lack Llama; this key exposes gpt-oss-120b. */
export const GROQ_MODEL = "openai/gpt-oss-120b";
/** OpenRouter `:free` models — override with OPENROUTER_MODEL. */
export const OPENROUTER_MODEL_DEFAULT =
  "meta-llama/llama-3.3-70b-instruct:free";

export type LlmProvider = "gemini" | "groq" | "openrouter";

export type ModelChoice = {
  model: LanguageModel;
  provider: LlmProvider;
};

const PROVIDER_ORDER: LlmProvider[] = ["groq", "openrouter", "gemini"];

function geminiModel(apiKey: string): LanguageModel {
  return createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL);
}

function groqModel(apiKey: string): LanguageModel {
  return createGroq({ apiKey })(GROQ_MODEL);
}

function openRouterModelId(): string {
  return (
    process.env.OPENROUTER_MODEL?.trim() || OPENROUTER_MODEL_DEFAULT
  );
}

function openrouterModel(apiKey: string): LanguageModel {
  const siteUrl = process.env.OPENROUTER_SITE_URL?.trim();
  const title = process.env.OPENROUTER_APP_NAME?.trim() || "Mahindra AI Agent";
  const headers: Record<string, string> = { "X-Title": title };
  if (siteUrl) headers["HTTP-Referer"] = siteUrl;

  const openrouter = createOpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    headers,
  });
  return openrouter(openRouterModelId());
}

function tryProvider(provider: LlmProvider): ModelChoice | null {
  if (provider === "groq") {
    const key = process.env.GROQ_API_KEY?.trim();
    if (!key) return null;
    return { model: groqModel(key), provider: "groq" };
  }
  if (provider === "openrouter") {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    if (!key) return null;
    return { model: openrouterModel(key), provider: "openrouter" };
  }
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!key) return null;
  return { model: geminiModel(key), provider: "gemini" };
}

/** Groq → OpenRouter → Gemini (first keyed provider wins). */
export function resolveModel(): ModelChoice {
  for (const provider of PROVIDER_ORDER) {
    const choice = tryProvider(provider);
    if (choice) return choice;
  }

  throw new Error(
    "No LLM API key configured. Set GROQ_API_KEY, OPENROUTER_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
  );
}

/** Next configured provider after primary errors. */
export function resolveFallbackModel(
  primary: LlmProvider,
): ModelChoice | null {
  for (const provider of PROVIDER_ORDER) {
    if (provider === primary) continue;
    const choice = tryProvider(provider);
    if (choice) return choice;
  }
  return null;
}
