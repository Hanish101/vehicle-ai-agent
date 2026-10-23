// Seed Zoho CRM from scripts/seed_data.json.
// Needs Node 18+ (built-in fetch). No npm install needed.
// Copy .env.example to .env.local at the repo root and fill in:
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_API_DOMAIN, ZOHO_ACCOUNTS_DOMAIN, ZOHO_VEHICLE_FIELD
// Custom fields needed first (API names in seed_data.json, except vehicle):
//   Leads: Preferred_City, plus ZOHO_VEHICLE_FIELD (default Vehicle_Model)
//   Deals: Booking_ID, Allocation_Status, VIN, Balance_Payment_URL,
//          Test_Drive_Time, vehicle field, stage "Closed Won - Booking Done"
// Safe to re-run: existing records are skipped.
// Usage: npm run seed:zoho
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]]) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

// .env.local wins over .env. Values already in the process are left alone.
loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

function domain(name, fallback) {
  return (process.env[name] || fallback).replace(/\/$/, "");
}

const ACCOUNTS = domain("ZOHO_ACCOUNTS_DOMAIN", "https://accounts.zoho.in");
const API = `${domain("ZOHO_API_DOMAIN", "https://www.zohoapis.in")}/crm/v6`;
const VEHICLE_FIELD = process.env.ZOHO_VEHICLE_FIELD || "Vehicle_Model";

function withVehicleField(record) {
  if (!Object.prototype.hasOwnProperty.call(record, "Vehicle_Model") || VEHICLE_FIELD === "Vehicle_Model") {
    return record;
  }
  const { Vehicle_Model, ...rest } = record;
  return { ...rest, [VEHICLE_FIELD]: Vehicle_Model };
}

async function authHeaders() {
  const keys = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"];
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(", ")} (set them in .env.local)`);
  const r = await fetch(`${ACCOUNTS}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      refresh_token: process.env.ZOHO_REFRESH_TOKEN,
    }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`Token error (check accounts domain and keys): ${j.error || r.status}`);
  return { Authorization: `Zoho-oauthtoken ${j.access_token}`, "Content-Type": "application/json" };
}

async function find(h, module, criteria) {
  const r = await fetch(`${API}/${module}/search?criteria=${encodeURIComponent(criteria)}`, { headers: h });
  if (r.status === 204) return null;
  if (!r.ok) throw new Error(`Search ${module} failed: ${r.status} ${await r.text()}`);
  const data = (await r.json()).data || [];
  return data[0]?.id ?? null;
}

async function create(h, module, record, criteria, label) {
  const existing = await find(h, module, criteria);
  if (existing) { console.log(`skip  ${label} (already exists, id ${existing})`); return existing; }
  // Also match Contacts/Leads by email when phone search misses a duplicate.
  if (record.Email) {
    const byEmail = await find(h, module, `(Email:equals:${record.Email})`);
    if (byEmail) {
      console.log(`skip  ${label} (email exists, id ${byEmail})`);
      return byEmail;
    }
  }
  const r = await fetch(`${API}/${module}`, { method: "POST", headers: h, body: JSON.stringify({ data: [record] }) });
  const d = ((await r.json()).data || [{}])[0];
  if (d.status !== "success") {
    const dupId = d.details?.duplicate_record?.id;
    if (d.code === "DUPLICATE_DATA" && dupId) {
      console.log(`skip  ${label} (duplicate, id ${dupId})`);
      return dupId;
    }
    console.log(`FAIL  ${label}: ${d.code} ${d.message} ${JSON.stringify(d.details)}`);
    return null;
  }
  console.log(`ok    ${label}`);
  return d.details.id;
}

/** Patch demo booking fields onto an existing deal (seed skips creates). */
async function patchDeal(h, dealId, fields, label) {
  if (!dealId) return;
  const r = await fetch(`${API}/Deals/${dealId}`, {
    method: "PUT",
    headers: h,
    body: JSON.stringify({ data: [fields] }),
  });
  const d = ((await r.json()).data || [{}])[0];
  if (d.status !== "success") {
    console.log(`FAIL  patch ${label}: ${d.code} ${d.message}`);
    return;
  }
  console.log(`ok    patch ${label}`);
}

const data = JSON.parse(readFileSync(join(here, "seed_data.json"), "utf8"));
console.log(`Zoho ${API}  vehicle field ${VEHICLE_FIELD}`);
const h = await authHeaders();

const contactIds = {};
for (const { key, ...rec } of data.contacts) {
  contactIds[key] = await create(h, "Contacts", rec, `(Phone:equals:${rec.Phone})`, `Contact: ${rec.First_Name} ${rec.Last_Name}`);
}
for (const lead of data.leads) {
  const rec = withVehicleField(lead);
  await create(h, "Leads", rec, `(Phone:equals:${rec.Phone})`, `Lead: ${rec.First_Name} ${rec.Last_Name}`);
}
for (const { contact, ...deal } of data.deals) {
  const rec = withVehicleField(deal);
  if (contactIds[contact]) rec.Contact_Name = { id: contactIds[contact] };
  const id = await create(h, "Deals", rec, `(Deal_Name:equals:${rec.Deal_Name})`, `Deal: ${rec.Deal_Name}`);
  // Always re-link Contact + refresh demo fields (deals may have been created without Contact_Name).
  if (id) {
    const patch = {};
    if (contactIds[contact]) patch.Contact_Name = { id: contactIds[contact] };
    // Booking deal only: refresh VIN/URL/description. Never reset Test_Drive_Time
    // on the pipeline deal (that was wiping chat reschedules back to 28 Oct).
    if (rec.Booking_ID) {
      if (rec.VIN) patch.VIN = rec.VIN;
      if (rec.Balance_Payment_URL) patch.Balance_Payment_URL = rec.Balance_Payment_URL;
      if (rec.Allocation_Status) patch.Allocation_Status = rec.Allocation_Status;
      if (rec.Booking_ID) patch.Booking_ID = rec.Booking_ID;
      if (rec.Description) patch.Description = rec.Description;
    }
    if (Object.keys(patch).length) {
      await patchDeal(h, id, patch, `fields on ${rec.Deal_Name}`);
    }
  }
}
