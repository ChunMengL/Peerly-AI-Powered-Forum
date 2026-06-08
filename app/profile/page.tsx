import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

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
    .select(
      "display_name, username, avatar_url, role, lecturer_status, created_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const [
    { count: questionCount },
    { count: answerCount },
    { data: recentQuestions },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    supabase
      .from("questions")
      .select("id, title, status, view_count, created_at")
      .eq("author_id", user.id)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  const name = String(
    profile?.display_name ||
      user.user_metadata.full_name ||
      user.user_metadata.name ||
      "Peerly User",
  );
  const email = user.email || "No email available";
  const username = profile?.username
    ? `@${profile.username}`
    : "Username not set";
  const role = profile?.role || "student";
  const lecturerStatus = profile?.lecturer_status || "none";
  const picture =
    profile?.avatar_url ||
    user.user_metadata.avatar_url ||
    user.user_metadata.picture ||
    "";
  const joinedAt = profile?.created_at || user.created_at;
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <div className="profile-hero">
          <div className="profile-hero-head">
            <Link className="profile-back" href="/">
              Back to home
            </Link>
          </div>
          <div className="profile-hero-main">
            <div className="profile-top">
              <div
                aria-hidden="true"
                className="profile-avatar"
                style={
                  picture ? { backgroundImage: `url(${picture})` } : undefined
                }
              >
                {picture ? null : initials}
              </div>
              <div className="profile-intro">
                <span className="eyebrow">Peerly profile</span>
                <h1>{name}</h1>
                <p>{email}</p>
                <p>{username}</p>
                <div className="profile-badges">
                  <span className="badge success">{role}</span>
                  <span className="badge neutral">
                    Lecturer status: {lecturerStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className="profile-actions">
              <Link href="/profile/settings">Update profile</Link>
              <Link className="primary" href="/">
                Browse questions
              </Link>
              <Link href="/auth/logout">Sign out</Link>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          <section className="profile-card profile-stats">
            <div className="head">
              <h2>Activity</h2>
              <span className="pill">Account snapshot</span>
            </div>
            <div className="profile-stat-grid">
              <div className="profile-stat">
                <strong>{questionCount || 0}</strong>
                <span>Questions asked</span>
              </div>
              <div className="profile-stat">
                <strong>{answerCount || 0}</strong>
                <span>Answers shared</span>
              </div>
              <div className="profile-stat">
                <strong>{formatDate(joinedAt)}</strong>
                <span>Joined</span>
              </div>
            </div>
          </section>

          <section className="profile-card">
            <div className="head">
              <h2>Recent Questions</h2>
              <span className="pill">Latest 3</span>
            </div>
            {recentQuestions?.length ? (
              <ul className="profile-list">
                {recentQuestions.map((question) => (
                  <li key={question.id}>
                    <strong>{question.title}</strong>
                    <span>
                      {question.status} | {question.view_count} views |{" "}
                      {formatDate(question.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="profile-empty">
                <strong>No questions yet</strong>
                <span>
                  Your posted questions will appear here once the ask-question
                  flow is connected.
                </span>
              </div>
            )}
          </section>

          <section className="profile-card">
            <div className="head">
              <h2>AI Readiness</h2>
              <span className="pill">Next backend signals</span>
            </div>
            <ul className="profile-list">
              <li>
                <strong>Chatbot history</strong>
                <span>
                  Use this profile later to show saved AI conversations and
                  draft answers.
                </span>
              </li>
              <li>
                <strong>Recommendation profile</strong>
                <span>
                  Viewed questions, saved answers, and clicked recommendations
                  can become the user interest model.
                </span>
              </li>
            </ul>
          </section>
        </div>
      </section>
    </main>
  );
}
