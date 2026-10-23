import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModel } from "ai";

/** Keep in sync with scripts/check_llm.mjs */
export const GEMINI_MODEL = "gemini-3.5-flash";
/** Free-tier Groq keys often lack Llama; this key exposes gpt-oss-120b. */
export const GROQ_MODEL = "openai/gpt-oss-120b";

export type ModelChoice = {
  model: LanguageModel;
  provider: "gemini" | "groq";
};

function geminiModel(apiKey: string): LanguageModel {
  return createGoogleGenerativeAI({ apiKey })(GEMINI_MODEL);
}

function groqModel(apiKey: string): LanguageModel {
  return createGroq({ apiKey })(GROQ_MODEL);
}

/** Groq first when keyed; otherwise Gemini. */
export function resolveModel(): ModelChoice {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return { model: groqModel(groqKey), provider: "groq" };
  }

  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (googleKey) {
    return { model: geminiModel(googleKey), provider: "gemini" };
  }

  throw new Error(
    "No LLM API key configured. Set GROQ_API_KEY (primary) or GOOGLE_GENERATIVE_AI_API_KEY (fallback).",
  );
}

/** Other provider for failover after primary errors. */
export function resolveFallbackModel(
  primary: ModelChoice["provider"],
): ModelChoice | null {
  if (primary === "groq") {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!googleKey) return null;
    return { model: geminiModel(googleKey), provider: "gemini" };
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return null;
  return { model: groqModel(groqKey), provider: "groq" };
}
