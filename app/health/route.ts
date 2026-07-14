import { NextResponse } from "next/server";
import { getSupabaseBrowserConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    ok: true,
    supabaseConfigured: getSupabaseBrowserConfig().configured,
  });
}
