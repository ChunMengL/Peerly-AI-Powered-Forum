import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

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
    { data: interactionRows },
  ] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id),
    // Recent activity, not authorship: the threads this user actually opened or
    // commented on. Over-fetched because the same question repeats across
    // interactions and only distinct ones are shown.
    supabase
      .from("user_interactions")
      .select("question_id, interaction_type, created_at")
      .eq("user_id", user.id)
      .in("interaction_type", ["question_viewed", "comment_created"])
      .not("question_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const recentActivity: Array<{
    questionId: string;
    interactionType: string;
    at: string;
  }> = [];
  const seenQuestionIds = new Set<string>();
  for (const row of interactionRows || []) {
    if (!row.question_id || seenQuestionIds.has(row.question_id)) {
      continue;
    }
    seenQuestionIds.add(row.question_id);
    recentActivity.push({
      questionId: row.question_id,
      interactionType: row.interaction_type,
      at: row.created_at,
    });
    if (recentActivity.length === 5) {
      break;
    }
  }

  const { data: activityQuestions } = recentActivity.length
    ? await supabase
        .from("questions")
        .select("id, title")
        .in(
          "id",
          recentActivity.map((item) => item.questionId),
        )
    : { data: [] as { id: string; title: string }[] };

  const activityTitleById = new Map(
    (activityQuestions || []).map((question) => [question.id, question.title]),
  );

  // Saved answers, resolved to their threads. Separate lookups keep to the house
  // pattern (no embeds) so the hand-written database types stay happy.
  const { data: saveRows } = await supabase
    .from("answer_saves")
    .select("answer_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  const savedAnswerIds = (saveRows || []).map((row) => row.answer_id);
  const { data: savedAnswers } = savedAnswerIds.length
    ? await supabase
        .from("answers")
        .select("id, question_id")
        .in("id", savedAnswerIds)
    : { data: [] as { id: string; question_id: string }[] };

  const questionByAnswer = new Map(
    (savedAnswers || []).map((answer) => [answer.id, answer.question_id]),
  );
  const savedQuestionIds = [...new Set(questionByAnswer.values())];
  const { data: savedQuestions } = savedQuestionIds.length
    ? await supabase
        .from("questions")
        .select("id, title")
        .in("id", savedQuestionIds)
    : { data: [] as { id: string; title: string }[] };

  const titleByQuestion = new Map(
    (savedQuestions || []).map((question) => [question.id, question.title]),
  );
  const savedThreads = (saveRows || [])
    .map((row) => {
      const questionId = questionByAnswer.get(row.answer_id);
      return questionId
        ? {
            answerId: row.answer_id,
            questionId,
            title: titleByQuestion.get(questionId) || "Untitled question",
            savedAt: row.created_at,
          }
        : null;
    })
    .filter((thread): thread is NonNullable<typeof thread> => thread !== null);

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
                  {lecturerStatus === "none" || lecturerStatus === "rejected" ? (
                    <Link className="profile-back" href="/profile/verification">
                      Apply for verification
                    </Link>
                  ) : lecturerStatus === "pending" ? (
                    <Link className="profile-back" href="/profile/verification">
                      View application
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="profile-actions">
              <Link href="/profile/settings">Update profile</Link>
              <Link className="primary" href="/">
                Browse questions
              </Link>
              <form action="/auth/logout" method="post">
                <button type="submit">Sign out</button>
              </form>
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
              <h2>Recent Activity</h2>
              <span className="pill">Latest 5</span>
            </div>
            {recentActivity.length ? (
              <ul className="profile-list">
                {recentActivity.map((item) => (
                  <li key={item.questionId}>
                    <Link
                      className="profile-back"
                      href={`/questions/${item.questionId}`}
                    >
                      {activityTitleById.get(item.questionId) ||
                        "Untitled question"}
                    </Link>
                    <span>
                      {item.interactionType === "comment_created"
                        ? "Commented"
                        : "Viewed"}{" "}
                      {formatDate(item.at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="profile-empty">
                <strong>No activity yet</strong>
                <span>
                  Threads you open or comment on will show up here for quick
                  reference.
                </span>
              </div>
            )}
          </section>

          <section className="profile-card">
            <div className="head">
              <h2>Saved Answers</h2>
              <span className="pill">Latest 5</span>
            </div>
            {savedThreads.length ? (
              <ul className="profile-list">
                {savedThreads.map((thread) => (
                  <li key={thread.answerId}>
                    <Link className="profile-back" href={`/questions/${thread.questionId}`}>
                      {thread.title}
                    </Link>
                    <span>Saved {formatDate(thread.savedAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="profile-empty">
                <strong>No saved answers yet</strong>
                <span>
                  Use Save on any answer to keep it here for quick reference.
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
