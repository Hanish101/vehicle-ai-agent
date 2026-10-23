import { normalizeAuthJson } from "@/auth/body";
import { startUserSession } from "@/auth/current-user";
import { createUser } from "@/auth/users";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const limit = rateLimit("auth-register", 8);
  if (!limit.ok) {
    return Response.json(
      { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` },
      { status: 429 },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(normalizeAuthJson(json));
  if (!parsed.success) {
    return Response.json(
      { error: "Name, a valid email, and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (user === "exists") {
      return Response.json(
        { error: "An account with that email already exists." },
        { status: 409 },
      );
    }
    await startUserSession(user);
    return Response.json({ ok: true, name: user.name });
  } catch (err) {
    console.error(
      "auth register failed",
      err instanceof Error ? err.name : "unknown",
    );
    return Response.json(
      { error: "Account creation is unavailable." },
      { status: 503 },
    );
  }
}
