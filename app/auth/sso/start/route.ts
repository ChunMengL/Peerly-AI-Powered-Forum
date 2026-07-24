import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SSO_PROVIDERS = ["google", "github", "discord"] as const;
type SsoProvider = (typeof SSO_PROVIDERS)[number];

function isSsoProvider(value: string): value is SsoProvider {
  return (SSO_PROVIDERS as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") || "google";

  if (!isSsoProvider(provider)) {
    return NextResponse.redirect(
      new URL(
        "/login?status=error&message=Unknown%20sign-in%20provider.",
        request.nextUrl.origin,
      ),
    );
  }

  const supabase = await createSupabaseServerClient();
  const redirectTo = new URL("/auth/callback", request.nextUrl.origin);
  redirectTo.searchParams.set("next", "/profile");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
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
        `${provider} sign-in is not configured in Supabase Auth yet.`,
    );
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(data.url);
}
