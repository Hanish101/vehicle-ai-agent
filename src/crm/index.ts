import { createMockClient } from "./mock-client";
import { createZohoClient } from "./zoho-client";
import type { CrmClient } from "./types";

export type { CrmClient } from "./types";

export function getCrmClient(): CrmClient {
  const mode = (process.env.CRM_MODE || "mock").toLowerCase();

  if (mode === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRM_MODE=mock is not allowed in production.");
    }
    return createMockClient();
  }

  if (mode === "zoho") {
    return createZohoClient();
  }

  throw new Error(`Unknown CRM_MODE="${mode}". Use mock or zoho.`);
}
