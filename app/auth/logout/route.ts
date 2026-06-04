import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?status=info&message=Signed%20out.", request.nextUrl.origin),
  );

  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
  });

  return response;
}
