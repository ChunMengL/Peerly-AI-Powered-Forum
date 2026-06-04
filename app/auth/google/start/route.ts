import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getGoogleConfig, GOOGLE_STATE_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const config = getGoogleConfig(request.nextUrl.origin);

  if (!config.configured) {
    return NextResponse.json(
      {
        error: "Google OAuth is not configured.",
        missing: [
          !config.clientId ? "GOOGLE_CLIENT_ID" : null,
          !config.clientSecret ? "GOOGLE_CLIENT_SECRET" : null,
        ].filter(Boolean),
      },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", config.clientId);
  authUrl.searchParams.set("redirect_uri", config.redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("access_type", "offline");
  authUrl.searchParams.set("prompt", "consent");
  authUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    maxAge: 600,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
