import { normalizeAuthJson } from "@/auth/body";
import { startUserSession } from "@/auth/current-user";
import { verifyLogin } from "@/auth/users";
import { rateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const bodySchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});

export async function POST(req: Request) {
  const limit = rateLimit("auth-login", 8);
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
      { error: "Enter a valid email and a password of at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const user = await verifyLogin(parsed.data.email, parsed.data.password);
    if (!user) {
      return Response.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }
    await startUserSession(user);
    return Response.json({ ok: true, name: user.name });
  } catch (err) {
    console.error("auth login failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "Sign-in is unavailable." }, { status: 503 });
  }
}
