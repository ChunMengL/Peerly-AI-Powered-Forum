import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") || "/profile";

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?status=error&message=Missing%20authentication%20code.",
        request.nextUrl.origin,
      ),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const redirect = new URL("/login", request.nextUrl.origin);
    redirect.searchParams.set("status", "error");
    redirect.searchParams.set("message", error.message);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL(next, request.nextUrl.origin));
}
