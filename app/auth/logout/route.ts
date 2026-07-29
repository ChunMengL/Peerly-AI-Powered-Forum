import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST only. As a GET route this was signed out by Next's <Link> prefetch (and
// any link scanner), which is exactly the "logged in on /profile, signed out on
// /" bug — prefetch is production-only, so localhost never showed it.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  return NextResponse.redirect(
    new URL("/login?status=info&message=Signed%20out.", request.nextUrl.origin),
  );
}
