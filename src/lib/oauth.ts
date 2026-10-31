import { createHash, randomBytes } from "node:crypto";
import { getFsmeetApiBase, getSiteUrl } from "./site";

export type FsmeetProfile = {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  picture: string | null;
};

export function oauthCallbackUrl(): string {
  return `${getSiteUrl()}/api/auth/fsmeet/callback`;
}

export function isOAuthConfigured(): boolean {
  return Boolean(process.env.FSMEET_OAUTH_CLIENT_ID?.trim());
}

function clientId(): string {
  const id = process.env.FSMEET_OAUTH_CLIENT_ID?.trim();
  if (!id) throw new Error("FSMEET_OAUTH_CLIENT_ID is not set.");
  return id;
}

function scopes(): string[] {
  return (process.env.FSMEET_OAUTH_SCOPES?.trim() || "openid profile email")
    .split(/[\s,]+/)
    .filter(Boolean);
}

export function createPkce(): { verifier: string; challenge: string; state: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(24).toString("base64url");
  return { verifier, challenge, state };
}

export function buildAuthorizeUrl(input: { state: string; codeChallenge: string }): string {
  const url = new URL(`${getFsmeetApiBase()}/oauth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", oauthCallbackUrl());
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", scopes().join(" "));
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function profileFromIdToken(idToken: string): FsmeetProfile | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
    const id = pickString(payload, ["sub"]);
    if (!id) return null;
    const username = pickString(payload, ["preferred_username", "username"]) ?? id;
    return {
      id,
      username,
      displayName: pickString(payload, ["name"]) ?? username,
      email: pickString(payload, ["email"]),
      picture: pickString(payload, ["picture"]),
    };
  } catch {
    return null;
  }
}

export async function exchangeCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<FsmeetProfile> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: oauthCallbackUrl(),
    client_id: clientId(),
    code_verifier: input.codeVerifier,
  });
  const secret = process.env.FSMEET_OAUTH_CLIENT_SECRET?.trim();
  if (secret) body.set("client_secret", secret);

  const tokenUrl = `${getFsmeetApiBase()}/oauth/token`;
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const tokenJson = (await tokenResponse.json().catch(() => ({}))) as Record<string, unknown>;
  if (!tokenResponse.ok) {
    throw new Error("FSMeet token exchange failed.");
  }
  const accessToken = pickString(tokenJson, ["access_token"]);
  if (!accessToken) throw new Error("FSMeet token response did not include an access token.");

  const userinfoUrl = `${getFsmeetApiBase()}/oauth/userinfo`;
  const userinfoResponse = await fetch(userinfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (userinfoResponse.ok) {
    const profile = (await userinfoResponse.json().catch(() => ({}))) as Record<string, unknown>;
    const id = pickString(profile, ["sub"]);
    if (id) {
      const username = pickString(profile, ["preferred_username", "username"]) ?? id;
      return {
        id,
        username,
        displayName: pickString(profile, ["name"]) ?? username,
        email: pickString(profile, ["email"]),
        picture: pickString(profile, ["picture"]),
      };
    }
  }

  const idToken = pickString(tokenJson, ["id_token"]);
  if (idToken) {
    const fromId = profileFromIdToken(idToken);
    if (fromId) return fromId;
  }
  throw new Error("FSMeet did not return a user profile.");
}
