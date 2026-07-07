import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json, SkillLevel } from "@/lib/supabase/database.types";

export const dynamic = "force-dynamic";

const SKILL_LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced"];
const EXPLANATION_STYLES = [
  { value: "step_by_step", label: "Step-by-step" },
  { value: "conceptual", label: "Conceptual" },
  { value: "worked_examples", label: "Worked examples" },
  { value: "concise", label: "Concise" },
] as const;

function asPreferencesObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

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
  const skillLevelInput = String(formData.get("skillLevel") || "");
  const explanationStyleInput = String(formData.get("explanationStyle") || "");
  const goal = String(formData.get("goal") || "").trim();

  const skillLevel = SKILL_LEVELS.find((level) => level === skillLevelInput);
  const explanationStyle = EXPLANATION_STYLES.find(
    (style) => style.value === explanationStyleInput,
  )?.value;

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

  if (goal.length > 200) {
    redirect(
      `/profile/settings?status=error&message=${encodeURIComponent(
        "Learning goal must be no more than 200 characters.",
      )}`,
    );
  }

  // Merge into the saved preferences so keys this form does not manage survive.
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  const preferences: { [key: string]: Json | undefined } = {
    ...asPreferencesObject(currentProfile?.preferences),
  };
  if (explanationStyle) {
    preferences.explanation_style = explanationStyle;
  } else {
    delete preferences.explanation_style;
  }
  if (goal) {
    preferences.goal = goal;
  } else {
    delete preferences.goal;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      avatar_url: avatarUrl || null,
      display_name: displayName,
      username: username || null,
      skill_level: skillLevel ?? null,
      preferences,
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
    .select("display_name, username, avatar_url, skill_level, preferences")
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
  const preferences = asPreferencesObject(profile?.preferences);
  const savedExplanationStyle =
    typeof preferences.explanation_style === "string"
      ? preferences.explanation_style
      : "";
  const savedGoal = typeof preferences.goal === "string" ? preferences.goal : "";

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

            <div className="field">
              <label htmlFor="skillLevel">Skill level</label>
              <select
                defaultValue={profile?.skill_level || ""}
                id="skillLevel"
                name="skillLevel"
              >
                <option value="">Not set</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <span>Helps the AI tutor pitch answers at the right depth.</span>
            </div>

            <div className="field">
              <label htmlFor="explanationStyle">Explanation style</label>
              <select
                defaultValue={savedExplanationStyle}
                id="explanationStyle"
                name="explanationStyle"
              >
                <option value="">No preference</option>
                {EXPLANATION_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
              <span>How you prefer answers to be explained.</span>
            </div>

            <div className="field">
              <label htmlFor="goal">Learning goal (optional)</label>
              <input
                defaultValue={savedGoal}
                id="goal"
                name="goal"
                maxLength={200}
                placeholder="e.g. Pass my data structures final"
                type="text"
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
