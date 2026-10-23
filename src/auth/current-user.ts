import { cookies } from "next/headers";
import { getSession } from "@/session/cookie";
import type { SessionData } from "@/session/types";
import {
  USER_COOKIE,
  signUserToken,
  userCookieOptions,
  verifyUserToken,
} from "./token";
import { findUserById, type PublicUser } from "./users";

export async function getCurrentUser(): Promise<PublicUser | null> {
  const jar = await cookies();
  const token = jar.get(USER_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifyUserToken(token);
  if (!userId) {
    jar.delete(USER_COOKIE);
    return null;
  }
  const user = await findUserById(userId);
  if (!user) {
    jar.delete(USER_COOKIE);
    return null;
  }
  return user;
}

/** Copy the account onto the chat session so the bot can use name and email. */
export async function bindAccount(
  session: SessionData & { save: () => Promise<void> },
  user: PublicUser,
): Promise<void> {
  if (
    session.userId === user.id &&
    session.name === user.name &&
    session.email === user.email
  ) {
    return;
  }
  session.userId = user.id;
  session.name = user.name;
  session.email = user.email;
  await session.save();
}

export async function startUserSession(user: PublicUser): Promise<void> {
  const jar = await cookies();
  jar.set(USER_COOKIE, await signUserToken(user.id), userCookieOptions());
  const session = await getSession();
  session.userId = user.id;
  session.name = user.name;
  session.email = user.email;
  await session.save();
}

export async function endUserSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(USER_COOKIE);
  const session = await getSession();
  session.destroy();
}
