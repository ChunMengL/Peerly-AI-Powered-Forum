import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", request.nextUrl.origin);
  redirectTo.searchParams.set("next", "/profile");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: redirectTo.toString(),
    },
  });

  if (error || !data.url) {
    const redirect = new URL("/login", request.nextUrl.origin);
    redirect.searchParams.set("status", "error");
    redirect.searchParams.set(
      "message",
      error?.message ||
        "Google sign-in is not configured in Supabase Auth yet.",
    );
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(data.url);
}
