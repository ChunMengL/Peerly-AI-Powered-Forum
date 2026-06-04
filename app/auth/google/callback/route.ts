import { NextRequest, NextResponse } from "next/server";
import {
  encodeSession,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  getGoogleConfig,
  GOOGLE_STATE_COOKIE,
  loginRedirectUrl,
  SESSION_COOKIE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const config = getGoogleConfig(request.nextUrl.origin);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const storedState = request.cookies.get(GOOGLE_STATE_COOKIE)?.value;

  if (error) {
    return NextResponse.redirect(
      loginRedirectUrl(
        request.nextUrl.origin,
        "error",
        `Google sign-in was cancelled or failed: ${error}`,
      ),
    );
  }

  if (!code) {
    return NextResponse.redirect(
      loginRedirectUrl(
        request.nextUrl.origin,
        "error",
        "Google did not return an authorization code.",
      ),
    );
  }

  if (!returnedState || !storedState || returnedState !== storedState) {
    return NextResponse.redirect(
      loginRedirectUrl(
        request.nextUrl.origin,
        "error",
        "State validation failed. Please try again.",
      ),
    );
  }

  try {
    const tokenData = await exchangeCodeForTokens({
      code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });
    const profile = await fetchGoogleProfile(tokenData.access_token);

    const response = NextResponse.redirect(
      loginRedirectUrl(
        request.nextUrl.origin,
        "success",
        "Signed in with Google.",
        profile,
      ),
    );

    response.cookies.set(GOOGLE_STATE_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
    });
    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({
        name: profile.name,
        email: profile.email,
        picture: profile.picture,
        provider: "google",
      }),
      {
        httpOnly: true,
        maxAge: 86400,
        path: "/",
        sameSite: "lax",
      },
    );

    return response;
  } catch (authError) {
    const message =
      authError instanceof Error ? authError.message : "Google sign-in failed.";

    return NextResponse.redirect(
      loginRedirectUrl(request.nextUrl.origin, "error", message),
    );
  }
}
