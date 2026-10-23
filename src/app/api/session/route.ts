import { bindAccount, getCurrentUser } from "@/auth/current-user";
import { getSession } from "@/session/cookie";
import { wipeSessionSlots, type SessionData } from "@/session/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const iron = await getSession();
    const session = iron as typeof iron & SessionData;
    await bindAccount(session, user);
    return Response.json({
      stage: session.stage,
      vehicle: session.vehicle ?? null,
      city: session.city ?? null,
      name: session.name ?? null,
      demoDate: session.demoDate ?? null,
      demoTime: session.demoTime ?? null,
      hasPhone: Boolean(session.phone),
      hasEmail: Boolean(session.email),
      leadId: session.leadId ?? null,
      dealId: session.dealId ?? null,
      bookingId: session.bookingId ?? null,
    });
  } catch (err) {
    console.error(
      "session read failed",
      err instanceof Error ? err.name : "unknown",
    );
    return Response.json({ error: "Failed to read session" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "reset") {
      return Response.json({ error: "Unsupported action" }, { status: 400 });
    }
    const user = await getCurrentUser();
    if (!user) {
      return Response.json({ error: "Sign in required" }, { status: 401 });
    }
    const iron = await getSession();
    const session = iron as typeof iron & SessionData;
    wipeSessionSlots(session);
    await bindAccount(session, user);
    await session.save();
    return Response.json({ ok: true, stage: session.stage ?? "Discover" });
  } catch (err) {
    console.error(
      "session reset failed",
      err instanceof Error ? err.name : "unknown",
    );
    return Response.json({ error: "Failed to reset session" }, { status: 500 });
  }
}
