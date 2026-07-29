import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST only. As a GET route this was signed out by Next's <Link> prefetch (and
// any link scanner), which is exactly the "logged in on /profile, signed out on
// /" bug — prefetch is production-only, so localhost never showed it.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // 303, not the redirect() default of 307: 307 preserves the method, so the
  // browser re-POSTed to the target page route and got a 405. 303 forces GET.
  return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
}
