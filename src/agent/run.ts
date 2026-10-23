import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  generateText,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type LanguageModel,
  type UIMessage,
  type UIMessageChunk,
} from "ai";
import { buildSystemPrompt } from "./prompt";
import { buildTools } from "./tools";
import { applyStageFromUserText } from "./stages";
import { resolveFallbackModel, resolveModel } from "./model";
import type { SessionData } from "@/session/types";
import { trimMessages } from "@/session/cookie";

function lastUserText(messages: UIMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const text = m.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    if (text) return text;
  }
  return "";
}

/** Pull structured slots from form/user text so we do not re-ask. */
function hydrateSlotsFromUserText(session: SessionData, text: string) {
  const name = text.match(/\bname\s+(?:is\s+)?([^,.;]+)/i);
  const phone = text.match(/\bphone\s+(?:is\s+)?([+\d][\d\s-]{8,}\d)/i);
  const email = text.match(
    /\bemail\s+(?:is\s+)?([\w.+-]+@[\w.-]+\.[A-Za-z]{2,})/i,
  );
  const city = text.match(/\bcity\s+(?:is\s+)?([^,.;]+)/i);
  const booking = text.match(/\bbooking\s+id\s+(?:is\s+)?([A-Za-z0-9-]+)/i);
  const reg = text.match(/\bregistration\s+(?:is\s+)?([A-Za-z0-9\s-]+?)(?=,|\.|$)/i);

  if (name?.[1] && !session.name) session.name = name[1].trim();
  if (phone?.[1] && !session.phone) {
    session.phone = phone[1].replace(/\s+/g, "");
  }
  if (email?.[1] && !session.email) session.email = email[1].trim();
  if (city?.[1] && !session.city) session.city = city[1].trim();
  if (booking?.[1] && !session.bookingId) {
    session.bookingId = booking[1].trim().toUpperCase();
  }
  if (reg?.[1] && !session.vehicle) {
    session.pendingSlots = [
      ...(session.pendingSlots || []).filter((s) => s !== "registration"),
    ];
  }
  if (!session.vehicle) {
    if (/\bxuv700\b/i.test(text)) session.vehicle = "XUV700";
    else if (/\bthar\b/i.test(text)) session.vehicle = "Thar";
    else if (/\bscorpio-?n\b/i.test(text)) session.vehicle = "Scorpio-N";
  }
}

function startStream(options: {
  model: LanguageModel;
  system: string;
  messages: Awaited<ReturnType<typeof convertToModelMessages>>;
  tools: ReturnType<typeof buildTools>;
}) {
  return streamText({
    model: options.model,
    system: options.system,
    messages: options.messages,
    tools: options.tools,
    stopWhen: stepCountIs(5),
    maxRetries: 0,
    onError: ({ error }) => {
      console.error(
        "streamText error",
        error instanceof Error ? error.name : "unknown",
      );
    },
  });
}

const USER_FACING_ERROR =
  "We ran into a problem on our side. Please try again in a moment.";

function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "unknown error";
}

function logLlmFailure(label: string, error: unknown) {
  console.error(`[llm] ${label}:`, errorText(error));
}

async function pipeUiStream(
  writer: {
    write: (chunk: UIMessageChunk) => void;
  },
  stream: ReadableStream<UIMessageChunk>,
): Promise<void> {
  const reader = stream.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (value.type === "error") {
        throw new Error(value.errorText || "Model stream error");
      }
      writer.write(value);
    }
  } finally {
    reader.releaseLock();
  }
}

/** Failover without reusing a broken primary stream/undici session. */
async function runFallbackText(options: {
  model: LanguageModel;
  system: string;
  messages: Awaited<ReturnType<typeof convertToModelMessages>>;
  tools: ReturnType<typeof buildTools>;
  writer: { write: (chunk: UIMessageChunk) => void };
  stage: SessionData["stage"];
  provider: "gemini" | "groq";
}) {
  const result = await generateText({
    model: options.model,
    system: options.system,
    messages: options.messages,
    tools: options.tools,
    stopWhen: stepCountIs(5),
    maxRetries: 0,
  });
  const text = result.text?.trim();
  if (!text) {
    throw new Error(`${options.provider} returned empty text`);
  }
  const id = generateId();
  options.writer.write({ type: "text-start", id });
  options.writer.write({ type: "text-delta", id, delta: text });
  options.writer.write({ type: "text-end", id });
  options.writer.write({
    type: "finish",
    finishReason: "stop",
    messageMetadata: {
      stage: options.stage,
      provider: options.provider,
    },
  });
}

export async function runAgentTurn(options: {
  messages: UIMessage[];
  session: SessionData;
  onSessionUpdate: () => Promise<void>;
}) {
  const { messages, session, onSessionUpdate } = options;
  const userText = lastUserText(messages);
  if (userText) {
    session.stage = applyStageFromUserText(userText, session.stage);
    hydrateSlotsFromUserText(session, userText);
  }
  await onSessionUpdate();

  const system = buildSystemPrompt(session);
  const tools = buildTools(session);
  const modelMessages = await convertToModelMessages(messages);

  const primary = resolveModel();
  let usedProvider = primary.provider;

  const uiStream = createUIMessageStream({
    originalMessages: messages,
    execute: async ({ writer }) => {
      const writeMeta = () => {
        writer.write({
          type: "message-metadata",
          messageMetadata: {
            stage: session.stage,
            provider: usedProvider,
          },
        });
      };

      const runStreamed = async (model: LanguageModel) => {
        const result = startStream({
          model,
          system,
          messages: modelMessages,
          tools,
        });
        const stream = toUIMessageStream({
          stream: result.stream,
          tools,
          originalMessages: messages,
          onError: errorText,
          messageMetadata: ({ part }) => {
            if (part.type === "finish") {
              return {
                stage: session.stage,
                provider: usedProvider,
              };
            }
          },
        });
        await pipeUiStream(writer, stream);
      };

      writeMeta();

      try {
        await runStreamed(primary.model);
      } catch (primaryErr) {
        logLlmFailure(`${primary.provider} primary`, primaryErr);
        const fallback = resolveFallbackModel(primary.provider);
        if (!fallback) {
          console.error(
            `[llm] no fallback after ${primary.provider} (other provider key missing)`,
          );
          writer.write({ type: "error", errorText: USER_FACING_ERROR });
          return;
        }
        usedProvider = fallback.provider;
        writeMeta();
        try {
          await runFallbackText({
            model: fallback.model,
            system,
            messages: modelMessages,
            tools,
            writer,
            stage: session.stage,
            provider: fallback.provider,
          });
        } catch (fallbackErr) {
          logLlmFailure(`${fallback.provider} fallback`, fallbackErr);
          writer.write({ type: "error", errorText: USER_FACING_ERROR });
        }
      }
    },
    onFinish: async ({ messages: finalMessages }) => {
      session.messages = trimMessages(
        finalMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant" | "system",
          parts: m.parts
            .filter(
              (p): p is { type: "text"; text: string } => p.type === "text",
            )
            .map((p) => ({ type: "text" as const, text: p.text })),
        })),
        12,
      );
      await onSessionUpdate();
    },
  });

  return createUIMessageStreamResponse({ stream: uiStream });
}
