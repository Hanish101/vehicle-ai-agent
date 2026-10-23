import { runAgentTurn } from "@/agent/run";
import { rateLimit } from "@/lib/rate-limit";
import { getSession } from "@/session/cookie";
import type { SessionData } from "@/session/types";
import type { UIMessage } from "ai";

export async function POST(req: Request) {
  try {
    const iron = await getSession();
    const session = iron as typeof iron & SessionData;
    const limit = rateLimit(session.phone || "anon-session");
    if (!limit.ok) {
      return Response.json(
        {
          error: `Too many requests. Try again in ${limit.retryAfterSec}s.`,
        },
        { status: 429 },
      );
    }

    const body = (await req.json()) as { messages?: UIMessage[] };
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "messages required" }, { status: 400 });
    }

    return await runAgentTurn({
      messages,
      session,
      onSessionUpdate: async () => {
        // Must save inside the route handler — after() cannot mutate cookies.
        await iron.save();
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unexpected server error";
    console.error("chat route error", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: message }, { status: 500 });
  }
}
