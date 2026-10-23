export type Stage = "Discover" | "Pipeline" | "Booking" | "Service";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: Array<{ type: "text"; text: string } | Record<string, unknown>>;
};

export type SessionData = {
  stage: Stage;
  /** MongoDB user id for the signed-in account. */
  userId?: string;
  leadId?: string;
  dealId?: string;
  bookingId?: string;
  contactId?: string;
  phone?: string;
  name?: string;
  email?: string;
  city?: string;
  vehicle?: string;
  /** YYYY-MM-DD test-drive / demo date. */
  demoDate?: string;
  /** HH:MM test-drive / demo clock time. */
  demoTime?: string;
  registrationNumber?: string;
  odometerKm?: number;
  issueOrServiceType?: string;
  preferredCenter?: string;
  pendingSlots?: string[];
  messages: ChatMessage[];
};

export const DEFAULT_SESSION: SessionData = {
  stage: "Discover",
  messages: [],
};

/** Wipe CRM slots. Keeps the signed-in account (user id, name, email). */
export function wipeSessionSlots(session: SessionData): void {
  const userId = session.userId;
  const name = session.name;
  const email = session.email;
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
  delete session.demoDate;
  delete session.demoTime;
  delete session.registrationNumber;
  delete session.odometerKm;
  delete session.issueOrServiceType;
  delete session.preferredCenter;
  delete session.pendingSlots;
  delete session.userId;
  if (userId) {
    session.userId = userId;
    if (name) session.name = name;
    if (email) session.email = email;
  }
}
