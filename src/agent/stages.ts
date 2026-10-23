import type { Stage } from "@/session/types";

export const STAGES: Stage[] = [
  "Discover",
  "Pipeline",
  "Booking",
  "Service",
];

export type ToolName =
  | "createLead"
  | "lookupDeal"
  | "updateFollowUp"
  | "lookupBooking"
  | "createServiceCase";

const ALLOWED: Record<Stage, ToolName[]> = {
  Discover: ["createLead"],
  Pipeline: ["lookupDeal", "updateFollowUp"],
  Booking: ["lookupBooking"],
  Service: ["createServiceCase"],
};

export function toolsForStage(stage: Stage): ToolName[] {
  return ALLOWED[stage];
}

/** Discover only exposes createLead once lead slots + vehicle exist. */
export function toolsForSession(session: {
  stage: Stage;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  vehicle?: string;
}): ToolName[] {
  if (session.stage !== "Discover") return toolsForStage(session.stage);
  const ready = Boolean(
    session.name &&
      session.phone &&
      session.email &&
      session.city &&
      session.vehicle,
  );
  return ready ? ["createLead"] : [];
}

/** Explicit intent keywords can switch stage; ambiguous stays put. */
export function detectStageSwitch(
  text: string,
  current: Stage,
): Stage | null {
  const t = text.toLowerCase();

  const service =
    /\b(service|complaint|maintenance|odometer|workshop|servicing|repair)\b/.test(
      t,
    );
  const booking =
    /\b(booking|booked|delivery|vin|dispatch|in transit|balance payment|mah-?\d+)\b/.test(
      t,
    );
  // New test-drive requests stay on Discover (createLead). Pipeline is
  // existing-deal follow-up: quotation, dealer, my deal, follow-up.
  const pipeline =
    /\b(quotation|quote|dealer|my deal|follow[- ]?up)\b/.test(t);
  const discover =
    /\b(price|features|xuv|thar|scorpio|bolero|marazzo|3xo|roxx|ev|new (car|suv)|interested in)\b/.test(
      t,
    );

  if (service && current !== "Service") return "Service";
  if (booking && current !== "Booking") return "Booking";
  // Existing-deal follow-up from any stage (e.g. leftover Service session).
  if (pipeline && current !== "Pipeline") return "Pipeline";
  if (discover && current === "Service") return null;
  if (
    /\bi already booked\b|\bmy booking\b/.test(t) &&
    current === "Discover"
  ) {
    return "Booking";
  }
  return null;
}

export function applyStageFromUserText(
  text: string,
  current: Stage,
): Stage {
  return detectStageSwitch(text, current) ?? current;
}
