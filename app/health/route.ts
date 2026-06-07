import { NextRequest, NextResponse } from "next/server";
import { getGoogleConfig } from "@/lib/auth";
import {
  getSupabaseBrowserConfig,
  getSupabaseServiceConfig,
} from "@/lib/supabase/config";

export const runtime = "nodejs";

export function GET(request: NextRequest) {
  const config = getGoogleConfig(request.nextUrl.origin);
  const supabase = getSupabaseBrowserConfig();
  const supabaseAdmin = getSupabaseServiceConfig();

  return NextResponse.json({
    ok: true,
    authConfigured: config.configured,
    redirectUri: config.redirectUri,
    supabaseConfigured: supabase.configured,
    supabaseAdminConfigured: supabaseAdmin.configured,
  });
}
