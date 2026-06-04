import { NextRequest, NextResponse } from "next/server";
import { getGoogleConfig } from "@/lib/auth";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const config = getGoogleConfig(request.nextUrl.origin);

  return NextResponse.json({
    ok: true,
    authConfigured: config.configured,
    redirectUri: config.redirectUri,
  });
}
