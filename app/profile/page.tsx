import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, role, lecturer_status")
    .eq("id", user.id)
    .maybeSingle();

  const name =
    profile?.display_name ||
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    "Peerly User";
  const email = user.email || "No email available";
  const picture =
    profile?.avatar_url ||
    user.user_metadata.avatar_url ||
    user.user_metadata.picture ||
    "";

  return (
    <main className="profile-page">
      <section className="profile-card">
        <div className="profile-top">
          <div
            aria-hidden={!picture}
            className="profile-avatar"
            style={picture ? { backgroundImage: `url(${picture})` } : undefined}
          />
          <div>
            <h1>{name}</h1>
            <p>{email}</p>
            <p>
              Role: {profile?.role || "student"} | Lecturer status:{" "}
              {profile?.lecturer_status || "none"}
            </p>
          </div>
        </div>
        <div className="profile-actions">
          <Link className="primary" href="/">
            Back to home
          </Link>
          <Link href="/auth/logout">Sign out</Link>
        </div>
      </section>
    </main>
  );
}
