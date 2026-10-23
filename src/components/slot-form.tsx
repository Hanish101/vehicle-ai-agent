"use client";

import { useState } from "react";

export type CollectKind = "lead" | "pipeline" | "booking" | "service";

export type SlotKey =
  | "name"
  | "phone"
  | "email"
  | "city"
  | "dealId"
  | "bookingId"
  | "registrationNumber"
  | "odometerKm"
  | "issueOrServiceType"
  | "preferredCenter";

export type CollectRequest = {
  kind: CollectKind;
  fields: SlotKey[];
};

type KnownSlots = {
  name?: string | null;
  city?: string | null;
  hasPhone?: boolean;
  hasEmail?: boolean;
  bookingId?: string | null;
  dealId?: string | null;
};

type Props = {
  request: CollectRequest;
  known?: KnownSlots;
  busy?: boolean;
  onSubmit: (text: string) => void;
  onDismiss: () => void;
};

const KIND_LABELS: Record<CollectKind, string> = {
  lead: "A few details to continue",
  pipeline: "Look up your deal",
  booking: "Look up your booking",
  service: "Service request details",
};

const FIELD_META: Record<
  SlotKey,
  { label: string; type?: string; placeholder?: string; optional?: boolean }
> = {
  name: { label: "Name", placeholder: "Full name" },
  phone: { label: "Phone", type: "tel", placeholder: "+91…" },
  email: { label: "Email", type: "email", placeholder: "you@example.com" },
  city: { label: "City", placeholder: "Your city" },
  dealId: { label: "Deal ID", placeholder: "Optional", optional: true },
  bookingId: { label: "Booking ID", placeholder: "e.g. MAH-9921", optional: true },
  registrationNumber: {
    label: "Registration",
    placeholder: "e.g. MH04 AB 1234",
  },
  odometerKm: { label: "Odometer (km)", type: "number", placeholder: "42000" },
  issueOrServiceType: {
    label: "Issue / service type",
    placeholder: "Periodic / complaint…",
  },
  preferredCenter: { label: "Preferred center", placeholder: "Andheri" },
};

const ALLOWED: SlotKey[] = [
  "name",
  "phone",
  "email",
  "city",
  "dealId",
  "bookingId",
  "registrationNumber",
  "odometerKm",
  "issueOrServiceType",
  "preferredCenter",
];

const DEFAULT_FIELDS: Record<CollectKind, SlotKey[]> = {
  lead: ["name", "phone", "email", "city"],
  pipeline: ["phone", "dealId"],
  booking: ["bookingId", "phone"],
  service: [
    "registrationNumber",
    "odometerKm",
    "issueOrServiceType",
    "preferredCenter",
  ],
};

function alreadyKnown(key: SlotKey, known?: KnownSlots): boolean {
  if (!known) return false;
  if (key === "name") return Boolean(known.name);
  if (key === "city") return Boolean(known.city);
  if (key === "phone") return Boolean(known.hasPhone);
  if (key === "email") return Boolean(known.hasEmail);
  if (key === "bookingId") return Boolean(known.bookingId);
  if (key === "dealId") return Boolean(known.dealId);
  return false;
}

/** Drop fields we already have in session. */
export function filterMissingFields(
  fields: SlotKey[],
  known?: KnownSlots,
): SlotKey[] {
  return fields.filter((f) => !alreadyKnown(f, known));
}

export function SlotForm({
  request,
  known,
  busy,
  onSubmit,
  onDismiss,
}: Props) {
  const fields = filterMissingFields(request.fields, known);
  const [values, setValues] = useState<Record<string, string>>({});

  if (fields.length === 0) return null;

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function requiredOk(): boolean {
    return fields.every((key) => {
      if (FIELD_META[key].optional) return true;
      return Boolean(values[key]?.trim());
    });
  }

  function buildMessage(): string | null {
    if (!requiredOk()) return null;
    const parts: string[] = [];
    for (const key of fields) {
      const v = values[key]?.trim();
      if (!v) continue;
      if (key === "name") parts.push(`name ${v}`);
      else if (key === "phone") parts.push(`phone ${v}`);
      else if (key === "email") parts.push(`email ${v}`);
      else if (key === "city") parts.push(`city ${v}`);
      else if (key === "dealId") parts.push(`deal id ${v}`);
      else if (key === "bookingId") parts.push(`booking id ${v}`);
      else if (key === "registrationNumber") parts.push(`registration ${v}`);
      else if (key === "odometerKm") parts.push(`odometer ${v} km`);
      else if (key === "issueOrServiceType") parts.push(`issue/service: ${v}`);
      else if (key === "preferredCenter") parts.push(`preferred center ${v}`);
    }
    if (!parts.length) return null;

    if (request.kind === "lead") {
      return `Here are my details: ${parts.join(", ")}. Please continue.`;
    }
    if (request.kind === "pipeline") {
      return `Please look up my deal. ${parts.join(", ")}.`;
    }
    if (request.kind === "booking") {
      return `Please look up my booking. ${parts.join(", ")}.`;
    }
    return `Please create a service case. ${parts.join(", ")}.`;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = buildMessage();
    if (!text || busy) return;
    onSubmit(text);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-3 rounded-xl border border-border bg-background p-3"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {KIND_LABELS[request.kind]}
          {fields.length === 1 ? ` — ${FIELD_META[fields[0]].label}` : ""}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-muted hover:text-foreground"
        >
          Dismiss
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((key) => {
          const meta = FIELD_META[key];
          return (
            <label key={key} className="flex flex-col gap-1 text-xs">
              <span className="text-muted">
                {meta.label}
                {meta.optional ? "" : " *"}
              </span>
              <input
                type={meta.type || "text"}
                value={values[key] || ""}
                onChange={(e) => set(key, e.target.value)}
                placeholder={meta.placeholder}
                disabled={busy}
                className="rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-foreground/30"
              />
            </label>
          );
        })}
      </div>

      <button
        type="submit"
        disabled={busy || !buildMessage()}
        className="mt-3 w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
      >
        Continue
      </button>
    </form>
  );
}

/**
 * Marker formats:
 *   [[collect:lead:city]]
 *   [[collect:lead:name,phone,email,city]]
 *   [[collect:lead]]  → default lead fields
 */
export function parseCollectMarker(text: string): {
  clean: string;
  request: CollectRequest | null;
} {
  const re =
    /\[\[collect:(lead|pipeline|booking|service)(?::([a-zA-Z0-9_,]+))?\]\]/i;
  const m = text.match(re);
  if (!m) {
    return { clean: text.trim(), request: null };
  }

  const kind = m[1].toLowerCase() as CollectKind;
  const rawFields = (m[2] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean) as SlotKey[];

  const fields =
    rawFields.length > 0
      ? rawFields.filter((f) => ALLOWED.includes(f))
      : DEFAULT_FIELDS[kind];

  return {
    clean: text.replace(re, "").replace(/\n{3,}/g, "\n\n").trim(),
    request: fields.length ? { kind, fields } : null,
  };
}
