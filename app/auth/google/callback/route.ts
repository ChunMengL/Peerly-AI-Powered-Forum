import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const redirect = new URL("/login", request.nextUrl.origin);
  redirect.searchParams.set("status", "error");
  redirect.searchParams.set(
    "message",
    "Google OAuth is pointing to the old app callback. Configure Google to use your Supabase Auth callback URL instead.",
  );

  return NextResponse.redirect(redirect);
}
