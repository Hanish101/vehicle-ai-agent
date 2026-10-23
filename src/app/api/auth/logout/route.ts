import { endUserSession } from "@/auth/current-user";

export async function POST() {
  try {
    await endUserSession();
    return Response.json({ ok: true });
  } catch (err) {
    console.error("auth logout failed", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "Could not sign out." }, { status: 500 });
  }
}
