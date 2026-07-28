import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth probe for the client: the landing page fetches this to reconcile its
// topbar. It runs as a route handler (same code path as /api/questions, which
// reads the session cookie reliably on Vercel), rather than relying on the home
// page's Server Component render.
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ signedIn: false });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    signedIn: true,
    user: {
      name:
        profile?.display_name ||
        user.user_metadata.full_name ||
        user.user_metadata.name,
      email: user.email,
      picture: profile?.avatar_url || user.user_metadata.avatar_url,
    },
  });
}
