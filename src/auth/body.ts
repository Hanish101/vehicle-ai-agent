export function normalizeAuthJson(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const source = json as Record<string, unknown>;
  return {
    ...source,
    email:
      typeof source.email === "string"
        ? source.email.trim().toLowerCase()
        : source.email,
    name: typeof source.name === "string" ? source.name.trim() : source.name,
  };
}
