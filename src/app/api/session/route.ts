import { getSession } from "@/session/cookie";
import { wipeSessionSlots, type SessionData } from "@/session/types";

export async function GET() {
  try {
    const session = await getSession();
    return Response.json({
      stage: session.stage,
      vehicle: session.vehicle ?? null,
      city: session.city ?? null,
      name: session.name ?? null,
      hasPhone: Boolean(session.phone),
      hasEmail: Boolean(session.email),
      leadId: session.leadId ?? null,
      dealId: session.dealId ?? null,
      bookingId: session.bookingId ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read session";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    if (body.action !== "reset") {
      return Response.json({ error: "Unsupported action" }, { status: 400 });
    }
    const session = await getSession();
    wipeSessionSlots(session as typeof session & SessionData);
    await session.save();
    return Response.json({ ok: true, stage: session.stage ?? "Discover" });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to reset session";
    return Response.json({ error: message }, { status: 500 });
  }
}
