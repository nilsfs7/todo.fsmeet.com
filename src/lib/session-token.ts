import { getAuthSecret } from "./secrets";
import { decodeSignedValue, encodeSignedValue } from "./signed";

export const SESSION_COOKIE = "todo_session";
export const OAUTH_PENDING_COOKIE = "todo_oauth";

export const SESSION_TTL_SEC = 60 * 60 * 24 * 14;
export const PENDING_TTL_SEC = 60 * 10;

export type Session = {
  sub: string;
  username: string;
  displayName: string;
  email: string | null;
  picture: string | null;
  exp: number;
};

export type OAuthPending = {
  state: string;
  codeVerifier: string;
  returnTo: string;
  exp: number;
};

export function readSessionToken(token: string | undefined): Session | null {
  if (!token) return null;
  let secret: string;
  try {
    secret = getAuthSecret();
  } catch {
    return null;
  }
  const session = decodeSignedValue<Session>(token, secret);
  if (!session?.sub || !session.username || typeof session.exp !== "number") return null;
  if (session.exp < Date.now() / 1000) return null;
  return session;
}

export function encodeSession(input: Omit<Session, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC;
  return encodeSignedValue({ ...input, exp } satisfies Session, getAuthSecret());
}

export function encodePending(input: Omit<OAuthPending, "exp">): string {
  const exp = Math.floor(Date.now() / 1000) + PENDING_TTL_SEC;
  return encodeSignedValue({ ...input, exp } satisfies OAuthPending, getAuthSecret());
}

export function readPendingToken(token: string | undefined): OAuthPending | null {
  if (!token) return null;
  let secret: string;
  try {
    secret = getAuthSecret();
  } catch {
    return null;
  }
  const pending = decodeSignedValue<OAuthPending>(token, secret);
  if (!pending?.state || !pending.codeVerifier || typeof pending.exp !== "number") return null;
  if (pending.exp < Date.now() / 1000) return null;
  return pending;
}
