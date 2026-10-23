import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getCrmClient } from "@/crm";
import type { SessionData } from "@/session/types";
import { toolsForSession, type ToolName } from "./stages";

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "Customer" };
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

/** Reject prompt placeholders the model sometimes copies into tool args. */
function realSlot(
  value: string | undefined,
  fallback?: string,
): string | undefined {
  const pick = (v?: string) => {
    if (!v) return undefined;
    const t = v.trim();
    if (!t) return undefined;
    if (/^(set|collected|on file|unknown|n\/?a|none|null)$/i.test(t)) {
      return undefined;
    }
    return t;
  };
  return pick(value) ?? pick(fallback);
}

export function buildTools(session: SessionData): ToolSet {
  const crm = getCrmClient();
  const allowed = new Set<ToolName>(toolsForSession(session));

  const all = {
    createLead: tool({
      description:
        "Create a CRM lead after name, phone, email, and city are collected. Pass real values only — never placeholders like set or collected.",
      // Soft schema: reject placeholders in execute so bad model args do not hard-fail the stream.
      inputSchema: z.object({
        name: z.string().optional(),
        phone: z.string().optional(),
        email: z.string().optional(),
        city: z.string().optional(),
        vehicleModel: z.string().optional(),
      }),
      execute: async (input) => {
        if (!allowed.has("createLead")) {
          return {
            ok: false,
            error: "createLead is not allowed in this stage.",
          };
        }
        const name = realSlot(input.name, session.name);
        const phone = realSlot(input.phone, session.phone);
        const email = realSlot(input.email, session.email);
        const city = realSlot(input.city, session.city);
        const vehicleModel = realSlot(input.vehicleModel, session.vehicle);
        const missing = [
          !(name && name.length >= 2) && "name",
          !(phone && phone.replace(/\D/g, "").length >= 10) && "phone",
          !(email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && "email",
          !(city && city.length >= 2) && "city",
          !(vehicleModel && vehicleModel.length >= 2) && "vehicleModel",
        ].filter(Boolean);
        if (missing.length) {
          return {
            ok: false,
            error: `Missing lead fields: ${missing.join(", ")}. Ask the user for them before calling createLead.`,
          };
        }
        const { firstName, lastName } = splitName(name!);
        const result = await crm.createLead({
          firstName,
          lastName,
          phone: phone!,
          email: email!,
          city: city!,
          vehicleModel: vehicleModel!,
        });
        if (result.ok) {
          session.leadId = result.data.id;
          session.name = name;
          session.phone = phone;
          session.email = email;
          session.city = city;
          session.vehicle = vehicleModel;
        }
        return result;
      },
    }),

    lookupDeal: tool({
      description: "Look up a pipeline deal by phone or deal id.",
      inputSchema: z.object({
        phone: z.string().optional(),
        dealId: z.string().optional(),
      }),
      execute: async ({ phone, dealId }) => {
        if (!allowed.has("lookupDeal")) {
          return { ok: false, error: "lookupDeal is not allowed in this stage." };
        }
        const result = await crm.lookupDeal({ phone, dealId });
        if (result.ok) {
          session.dealId = result.data.id;
          if (result.data.phone) session.phone = result.data.phone;
          if (result.data.contactName) session.name = result.data.contactName;
          if (result.data.vehicleModel) {
            session.vehicle = result.data.vehicleModel;
          }
          if (result.data.bookingId) {
            session.bookingId = result.data.bookingId;
          }
        }
        return result;
      },
    }),

    updateFollowUp: tool({
      description:
        "Update deal follow-up. Pass dealId from lookupDeal. testDriveTime may be ISO or a phrase like 'next Monday 10 am' (normalized server-side). Always include notes with the user's preference text.",
      inputSchema: z.object({
        dealId: z.string().min(1),
        testDriveTime: z.string().optional(),
        notes: z.string().optional(),
        vehicleModel: z.string().optional(),
      }),
      execute: async (input) => {
        if (!allowed.has("updateFollowUp")) {
          return {
            ok: false,
            error: "updateFollowUp is not allowed in this stage.",
          };
        }
        const result = await crm.updateFollowUp(input);
        if (result.ok) {
          session.dealId = result.data.id;
        }
        return result;
      },
    }),

    lookupBooking: tool({
      description:
        "Look up a vehicle booking by booking id (e.g. MAH-9921) or phone.",
      inputSchema: z.object({
        bookingId: z.string().optional(),
        phone: z.string().optional(),
      }),
      execute: async ({ bookingId, phone }) => {
        if (!allowed.has("lookupBooking")) {
          return {
            ok: false,
            error: "lookupBooking is not allowed in this stage.",
          };
        }
        const result = await crm.lookupBooking({ bookingId, phone });
        if (result.ok) {
          session.bookingId = result.data.bookingId;
          session.dealId = result.data.dealId;
          if (result.data.phone) session.phone = result.data.phone;
          if (result.data.contactName) session.name = result.data.contactName;
          if (result.data.vehicleModel) {
            session.vehicle = result.data.vehicleModel;
          }
        }
        return result;
      },
    }),

    createServiceCase: tool({
      description:
        "Create a service case after registration, odometer, issue, and center are known.",
      inputSchema: z.object({
        registrationNumber: z.string().min(4),
        odometerKm: z.number().nonnegative(),
        issueOrServiceType: z.string().min(2),
        preferredCenter: z.string().min(2),
        phone: z.string().optional(),
      }),
      execute: async (input) => {
        if (!allowed.has("createServiceCase")) {
          return {
            ok: false,
            error: "createServiceCase is not allowed in this stage.",
          };
        }
        const result = await crm.createServiceCase({
          ...input,
          contactId: session.contactId,
          phone: input.phone ?? session.phone,
        });
        if (result.ok && result.data.contactId) {
          session.contactId = result.data.contactId;
        }
        return result;
      },
    }),
  };

  switch (session.stage) {
    case "Discover": {
      // Hard gate: no createLead until slots exist — stops fake "captured" replies.
      const leadReady = Boolean(
        session.name &&
          session.phone &&
          session.email &&
          session.city &&
          session.vehicle,
      );
      return leadReady ? { createLead: all.createLead } : {};
    }
    case "Pipeline":
      return {
        lookupDeal: all.lookupDeal,
        updateFollowUp: all.updateFollowUp,
      };
    case "Booking":
      return { lookupBooking: all.lookupBooking };
    case "Service":
      return { createServiceCase: all.createServiceCase };
  }
}
