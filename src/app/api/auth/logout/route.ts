import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/session";
import { assertSameOrigin, publicOrigin } from "@/lib/site";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  }
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", publicOrigin(request)), 303);
}
