import { NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const session = decodeSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ signedIn: false });
  }

  return NextResponse.json({ signedIn: true, user: session });
}
