import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/data";
import { getDb } from "@/lib/db";
import { exchangeCode } from "@/lib/oauth";
import { clearOAuthPendingCookie, readOAuthPendingCookie, setSessionCookie } from "@/lib/session";
import { getSiteUrl, sanitizeReturnTo } from "@/lib/site";

function loginError(code: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${code}`, getSiteUrl()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const pending = await readOAuthPendingCookie();
  const oauthError = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (oauthError || !pending || !state || state !== pending.state || !code) {
    await clearOAuthPendingCookie();
    return loginError(oauthError ? "denied" : "state");
  }

  try {
    const profile = await exchangeCode({ code, codeVerifier: pending.codeVerifier });
    await upsertUser(getDb(), {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      picture: profile.picture,
    });
    await setSessionCookie({
      sub: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      email: profile.email,
      picture: profile.picture,
    });
  } catch {
    await clearOAuthPendingCookie();
    return loginError("exchange");
  }

  await clearOAuthPendingCookie();
  return NextResponse.redirect(new URL(sanitizeReturnTo(pending.returnTo), getSiteUrl()));
}
