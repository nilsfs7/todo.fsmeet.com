import { NextResponse } from "next/server";
import { buildAuthorizeUrl, createPkce, isOAuthConfigured } from "@/lib/oauth";
import { setOAuthPendingCookie } from "@/lib/session";
import { sanitizeReturnTo } from "@/lib/site";

export async function GET(request: Request) {
  if (!isOAuthConfigured()) {
    return NextResponse.redirect(new URL("/login?error=config", request.url));
  }

  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get("returnTo"));
  const { verifier, challenge, state } = createPkce();
  await setOAuthPendingCookie({ state, codeVerifier: verifier, returnTo });
  return NextResponse.redirect(buildAuthorizeUrl({ state, codeChallenge: challenge }));
}
