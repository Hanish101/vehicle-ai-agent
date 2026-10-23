/** Compact signed cookie. Holds the user id only — name and email stay in MongoDB. */

export const USER_COOKIE = "oem-user";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

const enc = new TextEncoder();

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return value;
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const bin = atob(padded + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export function userCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export async function signUserToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const body = `${userId}.${exp}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

/** Returns the user id when the cookie signature and expiry are valid. */
export async function verifyUserToken(token: string): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  if (!userId || !expRaw || !sig) return null;
  if (!/^[a-f0-9]{24}$/.test(userId)) return null;
  const exp = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp <= now || exp > now + MAX_AGE_SEC + 60) {
    return null;
  }
  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      b64urlToBytes(sig),
      enc.encode(`${userId}.${expRaw}`),
    );
  } catch {
    return null;
  }
  return ok ? userId : null;
}
