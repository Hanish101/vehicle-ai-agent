export type Stage = "Discover" | "Pipeline" | "Booking" | "Service";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: "text"; text: string } | Record<string, unknown>>;
};

export type SessionData = {
  stage: Stage;
  leadId?: string;
  dealId?: string;
  bookingId?: string;
  contactId?: string;
  phone?: string;
  name?: string;
  email?: string;
  city?: string;
  vehicle?: string;
  pendingSlots?: string[];
  messages: ChatMessage[];
};

export const DEFAULT_SESSION: SessionData = {
  stage: "Discover",
  messages: [],
};

/** Wipe CRM slots. Object.assign(DEFAULT) alone leaves old phone/name/ids. */
export function wipeSessionSlots(session: SessionData): void {
  session.stage = "Discover";
  session.messages = [];
  delete session.leadId;
  delete session.dealId;
  delete session.bookingId;
  delete session.contactId;
  delete session.phone;
  delete session.name;
  delete session.email;
  delete session.city;
  delete session.vehicle;
  delete session.pendingSlots;
}
