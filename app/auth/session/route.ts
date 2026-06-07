import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    .select("display_name, avatar_url, role, lecturer_status")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    signedIn: true,
    user: {
      id: user.id,
      name:
        profile?.display_name ||
        user.user_metadata.full_name ||
        user.user_metadata.name,
      email: user.email,
      picture:
        profile?.avatar_url ||
        user.user_metadata.avatar_url ||
        user.user_metadata.picture,
      role: profile?.role || "student",
      lecturerStatus: profile?.lecturer_status || "none",
    },
  });
}
