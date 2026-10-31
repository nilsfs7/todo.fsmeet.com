import { cookies } from "next/headers";
import {
  encodePending,
  encodeSession,
  OAUTH_PENDING_COOKIE,
  PENDING_TTL_SEC,
  readPendingToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  type OAuthPending,
  type Session,
} from "./session-token";

export type { OAuthPending, Session };
export { OAUTH_PENDING_COOKIE, SESSION_COOKIE, readSessionToken };

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function readSession(): Promise<Session | null> {
  const jar = await cookies();
  return readSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(input: Omit<Session, "exp">): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(input), cookieOptions(SESSION_TTL_SEC));
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function setOAuthPendingCookie(pending: Omit<OAuthPending, "exp">): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_PENDING_COOKIE, encodePending(pending), cookieOptions(PENDING_TTL_SEC));
}

export async function readOAuthPendingCookie(): Promise<OAuthPending | null> {
  const jar = await cookies();
  return readPendingToken(jar.get(OAUTH_PENDING_COOKIE)?.value);
}

export async function clearOAuthPendingCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(OAUTH_PENDING_COOKIE);
}
