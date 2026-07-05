import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

function cleanUsername(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

async function updateProfile(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const displayName = String(formData.get("displayName") || "").trim();
  const username = cleanUsername(String(formData.get("username") || ""));
  const avatarUrl = String(formData.get("avatarUrl") || "").trim();

  if (!displayName || displayName.length < 2 || displayName.length > 50) {
    const errorMsg = !displayName
      ? "Display name is required."
      : displayName.length < 2
        ? "Display name must be at least 2 characters."
        : "Display name must be no more than 50 characters.";
    redirect(
      `/profile/settings?status=error&message=${encodeURIComponent(errorMsg)}`,
    );
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl || null,
      display_name: displayName,
      username: username || null,
    })
    .eq("id", user.id);

  if (error) {
    const redirectUrl = new URL(
      "/profile/settings",
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    );
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", error.message);
    redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
  }

  revalidatePath("/profile");
  revalidatePath("/profile/settings");
  redirect("/profile?status=success&message=Profile%20updated.");
}

export default async function ProfileSettingsPage({
  searchParams,
}: SettingsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const params = await searchParams;
  const status = params.status;
  const message = params.message;
  const displayName =
    profile?.display_name ||
    user.user_metadata.full_name ||
    user.user_metadata.name ||
    "";
  const avatarUrl =
    profile?.avatar_url ||
    user.user_metadata.avatar_url ||
    user.user_metadata.picture ||
    "";

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <div className="profile-hero profile-settings-hero">
          <div className="profile-hero-head">
            <Link className="profile-back" href="/profile">
              Back to profile
            </Link>
            <Link className="profile-back" href="/">
              Home
            </Link>
          </div>
          <div className="profile-intro">
            <span className="eyebrow">Profile settings</span>
            <h1>Update Profile</h1>
            <p>Keep your visible Peerly identity clear for classmates.</p>
          </div>
        </div>

        <section className="profile-card profile-settings-card">
          <form action={updateProfile} className="profile-form">
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input
                defaultValue={String(displayName)}
                id="displayName"
                name="displayName"
                placeholder="Your display name"
                required
                type="text"
              />
            </div>

            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                defaultValue={profile?.username || ""}
                id="username"
                name="username"
                placeholder="username"
                type="text"
              />
              <span>Use letters, numbers, and underscores only.</span>
            </div>

            <div className="field">
              <label htmlFor="avatarUrl">Avatar URL</label>
              <input
                defaultValue={String(avatarUrl)}
                id="avatarUrl"
                name="avatarUrl"
                placeholder="https://example.com/avatar.png"
                type="url"
              />
            </div>

            <div className="profile-actions">
              <button className="btn primary" type="submit">
                Save changes
              </button>
              <Link href="/profile">Cancel</Link>
            </div>
          </form>

          {message ? (
            <p className="auth-status" data-state={status || "info"}>
              {message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
