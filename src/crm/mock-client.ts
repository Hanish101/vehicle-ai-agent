import { normalizeTestDriveTime } from "@/lib/test-drive-time";
import type {
  AllocationStatus,
  BookingRecord,
  CrmClient,
  CrmResult,
  DealRecord,
  LeadInput,
  LeadRecord,
  ServiceCaseInput,
  ServiceCaseRecord,
} from "./types";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  registration?: string;
  vehicle?: string;
};

const contacts: Contact[] = [
  {
    id: "contact-priya",
    firstName: "Priya",
    lastName: "Patel",
    phone: "+919800000002",
    email: "priya.patel@example.com",
    city: "Pune",
  },
  {
    id: "contact-amit",
    firstName: "Amit",
    lastName: "Verma",
    phone: "+919800000003",
    email: "amit.verma@example.com",
    city: "Bengaluru",
  },
  {
    id: "contact-sunil",
    firstName: "Sunil",
    lastName: "Rao",
    phone: "+919800000004",
    email: "sunil.rao@example.com",
    city: "Mumbai",
    registration: "MH04 AB 1234",
    vehicle: "Thar LX",
  },
];

const leads: LeadRecord[] = [
  {
    id: "lead-rajesh",
    firstName: "Rajesh",
    lastName: "Sharma",
    phone: "+919800000001",
    email: "rajesh.sharma@example.com",
    city: "Mumbai",
    vehicleModel: "Thar",
  },
];

const deals: DealRecord[] = [
  {
    id: "deal-priya",
    name: "Priya Patel - XUV700",
    stage: "Qualification",
    phone: "+919800000002",
    contactName: "Priya Patel",
    vehicleModel: "XUV700",
    amount: 1999000,
    testDriveTime: "2026-10-28",
    description:
      "Test drive scheduled for XUV700 AX7 at Mahindra Andheri. Quote: Rs 19.99 lakh ex-showroom.",
  },
  {
    id: "deal-amit-booking",
    name: "Booking MAH-9921 - Scorpio-N Z8L",
    stage: "Closed Won - Booking Done",
    phone: "+919800000003",
    contactName: "Amit Verma",
    vehicleModel: "Scorpio-N",
    amount: 2215000,
    bookingId: "MAH-9921",
    allocationStatus: "In Transit",
    vin: "MA1TA2XX9N2DEMO01",
    balancePaymentUrl:
      "https://pay.demo.mahindra.local/balance/MAH-9921",
    description:
      "Booking amount Rs 21,000 paid. VIN: MA1TA2XX9N2DEMO01. Balance_Payment_URL: https://pay.demo.mahindra.local/balance/MAH-9921",
  },
];

const cases: ServiceCaseRecord[] = [];
let leadSeq = 1;
let caseSeq = 1;

function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return digits;
  return digits.slice(-10);
}

function phonesMatch(a?: string, b?: string): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  return Boolean(na && nb && na === nb);
}

function ok<T>(data: T): CrmResult<T> {
  return { ok: true, data };
}

function notFound(message: string): CrmResult<never> {
  return { ok: false, notFound: true, error: message };
}

function fail(message: string): CrmResult<never> {
  return { ok: false, error: message };
}

function toBooking(deal: DealRecord): BookingRecord | null {
  if (!deal.bookingId || !deal.allocationStatus) return null;
  return {
    id: `booking-${deal.bookingId}`,
    bookingId: deal.bookingId,
    dealId: deal.id,
    phone: deal.phone,
    contactName: deal.contactName,
    vehicleModel: deal.vehicleModel,
    allocationStatus: deal.allocationStatus,
    vin: deal.vin,
    balancePaymentUrl: deal.balancePaymentUrl,
    description: deal.description,
  };
}

export function createMockClient(): CrmClient {
  return {
    async createLead(input: LeadInput) {
      const existing = leads.find((l) => phonesMatch(l.phone, input.phone));
      if (existing) {
        if (input.demoDate) existing.demoDate = input.demoDate;
        if (input.demoTime) existing.demoTime = input.demoTime;
        return ok(existing);
      }
      const record: LeadRecord = {
        id: `lead-new-${leadSeq++}`,
        ...input,
      };
      leads.push(record);
      return ok(record);
    },

    async lookupDeal({ phone, dealId }) {
      if (!phone && !dealId) {
        return fail("Provide a phone number or deal id.");
      }
      const deal = deals.find(
        (d) =>
          (dealId && d.id === dealId) ||
          (phone && phonesMatch(d.phone, phone)),
      );
      if (!deal) {
        return notFound(
          "No deal found. Ask for the other identifier (phone or deal id).",
        );
      }
      return ok(deal);
    },

    async updateFollowUp({ dealId, testDriveTime, notes, vehicleModel }) {
      const deal = deals.find((d) => d.id === dealId);
      if (!deal) return notFound("Deal not found for update.");
      const noteParts: string[] = [];
      if (notes?.trim()) noteParts.push(notes.trim());
      const timeSource = testDriveTime?.trim() || notes?.trim();
      if (timeSource) {
        const normalized = normalizeTestDriveTime(timeSource);
        if (normalized.date) deal.testDriveTime = normalized.date;
        if (normalized.note && !noteParts.includes(normalized.note)) {
          noteParts.push(normalized.note);
        }
      }
      if (vehicleModel) deal.vehicleModel = vehicleModel;
      if (noteParts.length) {
        const addition = noteParts.join("\n");
        deal.description = deal.description
          ? `${deal.description}\n${addition}`
          : addition;
      }
      return ok(deal);
    },

    async lookupBooking({ bookingId, phone }) {
      if (!bookingId && !phone) {
        return fail("Provide a booking id or phone number.");
      }
      const deal = deals.find(
        (d) =>
          d.bookingId &&
          ((bookingId &&
            d.bookingId.toUpperCase() === bookingId.toUpperCase()) ||
            (phone && phonesMatch(d.phone, phone))),
      );
      if (!deal) {
        return notFound(
          "No booking found. Ask for the other identifier (booking id or phone).",
        );
      }
      const booking = toBooking(deal);
      if (!booking) return notFound("Deal is not in a booking stage.");
      return ok(booking);
    },

    async createServiceCase(input: ServiceCaseInput) {
      const contact =
        contacts.find(
          (c) =>
            (input.registrationNumber &&
              c.registration?.replace(/\s+/g, "").toUpperCase() ===
                input.registrationNumber.replace(/\s+/g, "").toUpperCase()) ||
            (input.phone && phonesMatch(c.phone, input.phone)) ||
            (input.contactId && c.id === input.contactId),
        ) ?? null;

      if (!contact && !input.phone) {
        return notFound(
          "Could not match an owner. Confirm registration number or phone.",
        );
      }

      const record: ServiceCaseRecord = {
        id: `case-${caseSeq++}`,
        ...input,
        contactId: contact?.id ?? input.contactId,
        contactName: contact
          ? `${contact.firstName} ${contact.lastName}`
          : undefined,
        phone: contact?.phone ?? input.phone,
      };
      cases.push(record);
      return ok(record);
    },
  };
}

export function isAllocationStatus(value: string): value is AllocationStatus {
  return (
    value === "In Transit" ||
    value === "Dispatch Pending" ||
    value === "Delivered"
  );
}
