import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { DEFAULT_SESSION, type SessionData } from "./types";

const COOKIE_NAME = "oem-chat-session";

function sessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be set to a string of at least 32 characters (npm run secret)",
    );
  }
  return {
    cookieName: COOKIE_NAME,
    password,
    ttl: 60 * 60 * 24 * 14,
    // Chat history can exceed one cookie; split across chunks.
    chunk: true,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions(),
  );
  if (!session.stage) {
    Object.assign(session, structuredClone(DEFAULT_SESSION));
  }
  if (!Array.isArray(session.messages)) {
    session.messages = [];
  }
  return session;
}

export function trimMessages<T>(messages: T[], max = 20): T[] {
  if (messages.length <= max) return messages;
  return messages.slice(messages.length - max);
}
