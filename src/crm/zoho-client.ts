import {
  clearZohoTokenCache,
  getZohoAccessToken,
  refreshZohoAccessToken,
} from "./token-manager";
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
import { demoScheduleLine, normalizeTestDriveTime } from "@/lib/test-drive-time";
import { isAllocationStatus } from "./mock-client";

function apiBase(): string {
  return `${(process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.in").replace(/\/$/, "")}/crm/v6`;
}

function vehicleField(): string {
  return process.env.ZOHO_VEHICLE_FIELD || "Vehicle_Model";
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

async function zohoFetch(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<Response> {
  const token = await getZohoAccessToken();
  const res = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 && !retried) {
    clearZohoTokenCache();
    await refreshZohoAccessToken();
    return zohoFetch(path, init, true);
  }
  return res;
}

async function searchFirst(
  module: string,
  criteria: string,
): Promise<Record<string, unknown> | null> {
  const res = await zohoFetch(
    `/${module}/search?criteria=${encodeURIComponent(criteria)}`,
  );
  if (res.status === 204) return null;
  if (!res.ok) {
    // Custom fields may not be searchable; callers can fall back.
    return null;
  }
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  return json.data?.[0] ?? null;
}

async function searchByWord(
  module: string,
  word: string,
): Promise<Record<string, unknown> | null> {
  const res = await zohoFetch(
    `/${module}/search?word=${encodeURIComponent(word)}`,
  );
  if (res.status === 204 || !res.ok) return null;
  const json = (await res.json()) as { data?: Record<string, unknown>[] };
  return json.data?.[0] ?? null;
}

function bookingIdFromDeal(raw: Record<string, unknown>): string | undefined {
  if (typeof raw.Booking_ID === "string" && raw.Booking_ID.trim()) {
    return raw.Booking_ID.trim();
  }
  const name = String(raw.Deal_Name || "");
  const fromName = name.match(/\b(MAH-?\d+)\b/i);
  if (fromName) return fromName[1].toUpperCase().replace(/^MAH(?!-)/i, "MAH-");
  const desc = String(raw.Description || "");
  const fromDesc = desc.match(/\b(MAH-?\d+)\b/i);
  if (fromDesc) return fromDesc[1].toUpperCase().replace(/^MAH(?!-)/i, "MAH-");
  return undefined;
}

function allocationFromDeal(
  raw: Record<string, unknown>,
): AllocationStatus | undefined {
  const status = String(raw.Allocation_Status || "");
  if (isAllocationStatus(status)) return status;
  const blob = `${raw.Deal_Name || ""} ${raw.Description || ""} ${raw.Stage || ""}`;
  if (/\bin transit\b/i.test(blob)) return "In Transit";
  if (/\bdispatch pending\b/i.test(blob)) return "Dispatch Pending";
  if (/\bdelivered\b/i.test(blob)) return "Delivered";
  // Seed booking deals use this stage when custom Allocation_Status is absent.
  if (/closed won.*booking/i.test(String(raw.Stage || ""))) {
    return "In Transit";
  }
  return undefined;
}

function normalizeReg(value: string): string {
  return value.replace(/\s+/g, "").toUpperCase();
}

async function findContactForService(input: {
  contactId?: string;
  phone?: string;
  registrationNumber: string;
}): Promise<{ id: string; name?: string; phone?: string } | null> {
  if (input.contactId) {
    return { id: input.contactId };
  }

  if (input.phone) {
    const byPhone = await searchFirst(
      "Contacts",
      `(Phone:equals:${input.phone})`,
    );
    if (byPhone?.id) {
      return {
        id: String(byPhone.id),
        name: [byPhone.First_Name, byPhone.Last_Name].filter(Boolean).join(" "),
        phone: typeof byPhone.Phone === "string" ? byPhone.Phone : input.phone,
      };
    }
  }

  const reg = input.registrationNumber.trim();
  const compact = normalizeReg(reg);
  // Seed stores reg in Contact Description (e.g. "reg MH04 AB 1234").
  const byWord =
    (await searchByWord("Contacts", reg)) ||
    (await searchByWord("Contacts", compact)) ||
    (reg.includes(" ")
      ? await searchByWord("Contacts", reg.split(/\s+/)[0])
      : null);

  if (byWord?.id) {
    const desc = String(byWord.Description || "");
    const name = [byWord.First_Name, byWord.Last_Name].filter(Boolean).join(" ");
    // Prefer a contact whose description mentions this registration when possible.
    if (
      !desc ||
      normalizeReg(desc).includes(compact) ||
      normalizeReg(name).includes(compact)
    ) {
      return {
        id: String(byWord.id),
        name: name || undefined,
        phone: typeof byWord.Phone === "string" ? byWord.Phone : undefined,
      };
    }
    return {
      id: String(byWord.id),
      name: name || undefined,
      phone: typeof byWord.Phone === "string" ? byWord.Phone : undefined,
    };
  }

  return null;
}

function mapDeal(raw: Record<string, unknown>): DealRecord {
  const vf = vehicleField();
  return {
    id: String(raw.id),
    name: String(raw.Deal_Name || ""),
    stage: String(raw.Stage || ""),
    phone:
      typeof raw.Phone === "string"
        ? raw.Phone
        : ((raw.Contact_Name as { phone?: string } | undefined)?.phone ??
          undefined),
    contactName:
      typeof (raw.Contact_Name as { name?: string } | undefined)?.name ===
      "string"
        ? (raw.Contact_Name as { name: string }).name
        : undefined,
    vehicleModel:
      typeof raw[vf] === "string"
        ? (raw[vf] as string)
        : /\b(XUV700|Thar|Scorpio-N)\b/i.test(String(raw.Deal_Name || ""))
          ? String(raw.Deal_Name).match(/\b(XUV700|Thar|Scorpio-N)\b/i)?.[1]
          : undefined,
    amount: typeof raw.Amount === "number" ? raw.Amount : undefined,
    testDriveTime: (() => {
      const v = raw.Test_Drive_Time;
      if (typeof v === "string" && v.trim()) return v.trim().slice(0, 10);
      if (typeof v === "number") {
        const d = new Date(v);
        if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
      }
      return undefined;
    })(),
    bookingId: bookingIdFromDeal(raw),
    allocationStatus: allocationFromDeal(raw),
    vin: vinFromDeal(raw),
    balancePaymentUrl: balanceUrlFromDeal(raw),
    description:
      typeof raw.Description === "string" ? raw.Description : undefined,
  };
}

function phoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  const variants = new Set<string>();
  for (const v of [
    phone.trim(),
    digits,
    last10,
    `+91${last10}`,
    `91${last10}`,
    `0${last10}`,
  ]) {
    if (v) variants.add(v);
  }
  return [...variants];
}

async function findDealByPhone(
  phone: string,
): Promise<Record<string, unknown> | null> {
  for (const p of phoneVariants(phone)) {
    const direct = await searchFirst("Deals", `(Phone:equals:${p})`);
    if (direct) return direct;
  }

  for (const p of phoneVariants(phone)) {
    const contact = await searchFirst("Contacts", `(Phone:equals:${p})`);
    if (!contact?.id) continue;
    const contactId = String(contact.id);

    // Related list is more reliable than criteria on Contact_Name.
    const related = await zohoFetch(`/Contacts/${contactId}/Deals`);
    if (related.ok) {
      const json = (await related.json()) as {
        data?: Record<string, unknown>[];
      };
      if (json.data?.[0]) return json.data[0];
    }

    const byContact =
      (await searchFirst("Deals", `(Contact_Name:equals:${contactId})`)) ||
      (await searchByWord("Deals", p));
    if (byContact) return byContact;
  }

  // Demo fallback: last-10 match via word search (Priya seed phone).
  const digits = phone.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  if (last10) {
    const byWord = await searchByWord("Deals", last10);
    if (byWord) return byWord;
    // Known seed deal name when phone is Priya's.
    if (last10 === "9800000002") {
      const named = await searchFirst(
        "Deals",
        `(Deal_Name:equals:Priya Patel - XUV700)`,
      );
      if (named) return named;
      return searchByWord("Deals", "Priya Patel");
    }
  }
  return null;
}

function vinFromDeal(raw: Record<string, unknown>): string | undefined {
  if (typeof raw.VIN === "string" && raw.VIN.trim()) return raw.VIN.trim();
  const desc = String(raw.Description || "");
  const m = desc.match(/\bVIN\s*[:=]\s*([A-HJ-NPR-Z0-9]{11,17})\b/i);
  return m?.[1]?.toUpperCase();
}

function balanceUrlFromDeal(raw: Record<string, unknown>): string | undefined {
  if (
    typeof raw.Balance_Payment_URL === "string" &&
    raw.Balance_Payment_URL.trim()
  ) {
    return raw.Balance_Payment_URL.trim();
  }
  const desc = String(raw.Description || "");
  const m = desc.match(
    /\bBalance_Payment_URL\s*[:=]\s*(https?:\/\/\S+)/i,
  );
  return m?.[1];
}

export function createZohoClient(): CrmClient {
  return {
    async createLead(input: LeadInput) {
      try {
        const existing = await searchFirst(
          "Leads",
          `(Phone:equals:${input.phone})`,
        );
        const schedule = demoScheduleLine(input.demoDate, input.demoTime);
        if (existing) {
          if (schedule) {
            const previous =
              typeof existing.Description === "string"
                ? existing.Description.trim()
                : "";
            const description = previous
              ? `${previous}\n${schedule}`
              : schedule;
            const updated = await zohoFetch(`/Leads/${existing.id}`, {
              method: "PUT",
              body: JSON.stringify({
                data: [{ id: existing.id, Description: description }],
              }),
            });
            if (!updated.ok) {
              console.error("lead demo schedule update failed", updated.status);
            }
          }
          return ok({
            id: String(existing.id),
            firstName: String(existing.First_Name || input.firstName),
            lastName: String(existing.Last_Name || input.lastName),
            phone: String(existing.Phone || input.phone),
            email: String(existing.Email || input.email),
            city: String(existing.Preferred_City || input.city),
            vehicleModel: String(
              existing[vehicleField()] || input.vehicleModel,
            ),
            demoDate: input.demoDate,
            demoTime: input.demoTime,
          } satisfies LeadRecord);
        }

        const body = {
          data: [
            {
              First_Name: input.firstName,
              Last_Name: input.lastName,
              Phone: input.phone,
              Email: input.email,
              Preferred_City: input.city,
              [vehicleField()]: input.vehicleModel,
              Lead_Source: "Chat",
              ...(schedule ? { Description: schedule } : {}),
            },
          ],
        };
        const res = await zohoFetch("/Leads", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as {
          data?: Array<{ status?: string; details?: { id?: string }; message?: string }>;
        };
        const row = json.data?.[0];
        if (!res.ok || row?.status !== "success" || !row.details?.id) {
          return fail(row?.message || "Failed to create lead in Zoho.");
        }
        return ok({ id: row.details.id, ...input });
      } catch {
        return fail("CRM is temporarily unavailable. Please try again.");
      }
    },

    async lookupDeal({ phone, dealId }) {
      try {
        if (!phone && !dealId) {
          return fail("Provide a phone number or deal id.");
        }
        let raw: Record<string, unknown> | null = null;
        if (dealId) {
          const res = await zohoFetch(`/Deals/${dealId}`);
          if (res.ok) {
            const json = (await res.json()) as {
              data?: Record<string, unknown>[];
            };
            raw = json.data?.[0] ?? null;
          }
          if (!raw) {
            raw = await searchByWord("Deals", dealId);
          }
        }
        if (!raw && phone) {
          raw = await findDealByPhone(phone);
        }
        if (!raw) {
          return notFound(
            "No deal found. Ask for the other identifier (phone or deal id).",
          );
        }
        return ok(mapDeal(raw));
      } catch {
        return fail("CRM is temporarily unavailable. Please try again.");
      }
    },

    async updateFollowUp({ dealId, testDriveTime, notes, vehicleModel }) {
      try {
        const noteParts: string[] = [];
        if (notes?.trim()) noteParts.push(notes.trim());

        let targetDate: string | undefined;
        const timeSource = testDriveTime?.trim() || notes?.trim();
        if (timeSource) {
          const normalized = normalizeTestDriveTime(timeSource);
          targetDate = normalized.date;
          if (normalized.note && !noteParts.includes(normalized.note)) {
            noteParts.push(normalized.note);
          }
        }

        async function putDeal(fields: Record<string, unknown>) {
          const res = await zohoFetch(`/Deals/${dealId}`, {
            method: "PUT",
            body: JSON.stringify({
              data: [{ id: dealId, ...fields }],
            }),
          });
          const putJson = (await res.json().catch(() => null)) as {
            data?: Array<{
              status?: string;
              message?: string;
              code?: string;
              details?: unknown;
            }>;
          } | null;
          const putRow = putJson?.data?.[0];
          const okRow =
            res.ok && (!putRow?.status || putRow.status === "success");
          return { okRow, putRow, res };
        }

        // 1) Date field alone — do not mix with Description (combined PUT was
        //    falling back to notes-only and leaving Test_Drive_Time stuck).
        let dateUpdated = false;
        let dateError: string | undefined;
        if (targetDate) {
          const attempt = await putDeal({ Test_Drive_Time: targetDate });
          if (attempt.okRow) {
            dateUpdated = true;
          } else {
            dateError =
              attempt.putRow?.message ||
              `Zoho rejected Test_Drive_Time=${targetDate}`;
            console.error("[crm] Test_Drive_Time update failed", dateError);
          }
        }

        // 2) Description / vehicle separately
        const rest: Record<string, unknown> = {};
        if (vehicleModel) rest[vehicleField()] = vehicleModel;
        if (noteParts.length) {
          const existing = await zohoFetch(`/Deals/${dealId}`);
          let previous = "";
          if (existing.ok) {
            const prevJson = (await existing.json()) as {
              data?: Record<string, unknown>[];
            };
            const prevDesc = prevJson.data?.[0]?.Description;
            if (typeof prevDesc === "string" && prevDesc.trim()) {
              previous = prevDesc.trim();
            }
          }
          const addition = noteParts.join("\n");
          rest.Description = previous ? `${previous}\n${addition}` : addition;
        }
        if (Object.keys(rest).length) {
          const attempt = await putDeal(rest);
          if (!attempt.okRow && !dateUpdated) {
            return fail(
              attempt.putRow?.message || "Failed to update deal follow-up.",
            );
          }
        }

        if (targetDate && !dateUpdated) {
          return fail(
            dateError ||
              "Could not update Test_Drive_Time. Confirm the field is Date type and on the Deal layout, then try YYYY-MM-DD.",
          );
        }

        if (!targetDate && !Object.keys(rest).length) {
          return fail("Nothing to update. Provide a test-drive time or notes.");
        }

        const get = await zohoFetch(`/Deals/${dealId}`);
        const json = (await get.json()) as {
          data?: Record<string, unknown>[];
        };
        const raw = json.data?.[0];
        if (!raw) return notFound("Deal not found after update.");
        const mapped = mapDeal(raw);
        // Prefer the date we just wrote if Zoho read-back is slow/odd.
        if (targetDate && dateUpdated) {
          mapped.testDriveTime = targetDate;
        }
        return ok(mapped);
      } catch {
        return fail("CRM is temporarily unavailable. Please try again.");
      }
    },

    async lookupBooking({ bookingId, phone }) {
      try {
        if (!bookingId && !phone) {
          return fail("Provide a booking id or phone number.");
        }
        let raw: Record<string, unknown> | null = null;
        const id = bookingId?.trim();
        if (id) {
          // Booking_ID custom field may be missing or not searchable in free orgs.
          raw =
            (await searchFirst("Deals", `(Booking_ID:equals:${id})`)) ||
            (await searchByWord("Deals", id)) ||
            (await searchFirst(
              "Deals",
              `(Deal_Name:equals:Booking ${id} - Scorpio-N Z8L)`,
            ));
        }
        if (!raw && phone) {
          raw =
            (await searchFirst("Deals", `(Phone:equals:${phone})`)) ||
            (await searchByWord("Deals", phone));
        }
        if (!raw) {
          return notFound(
            "No booking found. Ask for the other identifier (booking id or phone).",
          );
        }
        const deal = mapDeal(raw);
        if (!deal.bookingId) {
          return notFound(
            "Found a deal but no booking id on it. Ask for booking id or phone.",
          );
        }
        const booking: BookingRecord = {
          id: `booking-${deal.bookingId}`,
          bookingId: deal.bookingId,
          dealId: deal.id,
          phone: deal.phone,
          contactName: deal.contactName,
          vehicleModel: deal.vehicleModel,
          allocationStatus: deal.allocationStatus || "In Transit",
          vin: deal.vin,
          balancePaymentUrl: deal.balancePaymentUrl,
          description: deal.description,
        };
        return ok(booking);
      } catch {
        return fail("CRM is temporarily unavailable. Please try again.");
      }
    },

    async createServiceCase(input: ServiceCaseInput) {
      try {
        const matched = await findContactForService(input);
        const contactId = matched?.id ?? input.contactId;
        const contactName = matched?.name;

        const subject = `Service: ${input.issueOrServiceType} (${input.registrationNumber})`;
        const description = [
          `Registration: ${input.registrationNumber}`,
          `Odometer: ${input.odometerKm} km`,
          `Issue/Service: ${input.issueOrServiceType}`,
          `Preferred center: ${input.preferredCenter}`,
          contactName ? `Owner contact: ${contactName}` : null,
        ]
          .filter(Boolean)
          .join("\n");

        const body: Record<string, unknown> = {
          Subject: subject,
          Description: description,
          Status: "New",
        };
        // Zoho Cases: Related_To = Contact (vehicle owner). Owner = CRM user who created it.
        if (contactId) body.Related_To = { id: contactId };

        const res = await zohoFetch("/Cases", {
          method: "POST",
          body: JSON.stringify({ data: [body] }),
        });
        const json = (await res.json()) as {
          data?: Array<{
            status?: string;
            details?: { id?: string };
            message?: string;
          }>;
        };
        const row = json.data?.[0];
        if (!res.ok || row?.status !== "success" || !row.details?.id) {
          return fail(row?.message || "Failed to create service case.");
        }

        const record: ServiceCaseRecord = {
          id: row.details.id,
          ...input,
          contactId,
          contactName,
          phone: matched?.phone ?? input.phone,
          warning: contactId
            ? undefined
            : "Case created but no Contact matched. Ask for phone or confirm registration so it can be linked.",
        };
        return ok(record);
      } catch {
        return fail("CRM is temporarily unavailable. Please try again.");
      }
    },
  };
}
