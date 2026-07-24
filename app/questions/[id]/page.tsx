import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { questions as fallbackQuestions } from "@/lib/questions";
import type { InteractionType, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type QuestionPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

type DatabaseQuestion = {
  id: string;
  author_id: string;
  subject_id: string | null;
  preferred_answer_id: string | null;
  title: string;
  body: string;
  status: string;
  view_count: number;
  created_at: string;
};

type DatabaseAnswer = {
  id: string;
  author_id: string | null;
  body: string;
  source: string;
  score: number;
  created_at: string;
};

type DatabaseVerification = {
  id: string;
  answer_id: string;
  lecturer_id: string;
  verdict: "verified" | "disputed";
  note: string | null;
  created_at: string;
};

type DatabaseComment = {
  id: string;
  answer_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
};

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function questionRedirectPath(
  questionId: string,
  status: "success" | "error" | "info",
  message: string,
) {
  const params = new URLSearchParams({ status, message });
  return `/questions/${questionId}?${params.toString()}`;
}

async function logInteraction(
  supabase: SupabaseServerClient,
  interaction: {
    user_id: string;
    interaction_type: InteractionType;
    question_id: string;
    answer_id?: string;
    metadata?: Json;
  },
) {
  // Best-effort ranking signal for Phase 3; a failure here must not block the action.
  await supabase.from("user_interactions").insert(interaction);
}

// Fire-and-forget on question load: bump the public view counter (via the
// SECURITY DEFINER RPC, since RLS blocks direct UPDATEs) and, for signed-in
// readers, log a question_viewed ranking signal. Never awaited by the render and
// errors are swallowed, so view logging can neither delay nor break the page.
//
// The two must run in sequence, not in parallel: the RPC dedups a signed-in
// reader's views by looking for their question_viewed row, so writing that
// marker alongside the RPC would race its own dedup check and let the first
// refresh double-count.
function recordQuestionView(
  supabase: SupabaseServerClient,
  questionId: string,
  userId: string | null,
) {
  const bump = supabase.rpc("increment_question_view", {
    question_id: questionId,
    viewer_id: userId,
  });

  // Promise.resolve because rpc() returns a thenable builder, not a real Promise.
  void Promise.resolve(bump)
    .then(() =>
      userId
        ? logInteraction(supabase, {
            user_id: userId,
            interaction_type: "question_viewed",
            question_id: questionId,
          })
        : undefined,
    )
    .catch(() => {});
}

async function createAnswer(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!questionId) {
    redirect("/");
  }

  if (body.length < 10) {
    redirect(
      `/questions/${questionId}?status=error&message=Answer%20must%20be%20at%20least%2010%20characters.`,
    );
  }

  const { error } = await supabase.from("answers").insert({
    author_id: user.id,
    body,
    question_id: questionId,
    source: "user",
  });

  if (error) {
    const redirectUrl = new URL(
      `/questions/${questionId}`,
      process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
    );
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", error.message);
    redirect(`${redirectUrl.pathname}${redirectUrl.search}`);
  }

  revalidatePath(`/questions/${questionId}`);
  revalidatePath("/");
  revalidatePath("/profile");
  redirect(`/questions/${questionId}?status=success&message=Answer%20posted.`);
}

async function voteOnAnswer(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20to%20vote.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();
  const value = Number(formData.get("value"));

  if (!questionId) {
    redirect("/");
  }

  if (!answerId || (value !== 1 && value !== -1)) {
    redirect(questionRedirectPath(questionId, "error", "Invalid vote."));
  }

  const { data: existingVote } = await supabase
    .from("answer_votes")
    .select("value")
    .eq("answer_id", answerId)
    .eq("voter_id", user.id)
    .maybeSingle();

  const isRemovingVote = existingVote?.value === value;
  const { error } = isRemovingVote
    ? await supabase
        .from("answer_votes")
        .delete()
        .eq("answer_id", answerId)
        .eq("voter_id", user.id)
    : await supabase
        .from("answer_votes")
        .upsert(
          { answer_id: answerId, value, voter_id: user.id },
          { onConflict: "answer_id,voter_id" },
        );

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  if (!isRemovingVote) {
    await logInteraction(supabase, {
      user_id: user.id,
      interaction_type: "vote_cast",
      question_id: questionId,
      answer_id: answerId,
      metadata: { value },
    });
  }

  revalidatePath(`/questions/${questionId}`);
  revalidatePath("/");
  // Land on the clean path so a stale ?status/&message banner from a previous
  // action doesn't linger after a vote.
  redirect(`/questions/${questionId}`);
}

async function toggleSaveAnswer(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20to%20save%20answers.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();

  if (!questionId) {
    redirect("/");
  }

  if (!answerId) {
    redirect(questionRedirectPath(questionId, "error", "Invalid answer."));
  }

  const { data: existingSave } = await supabase
    .from("answer_saves")
    .select("answer_id")
    .eq("answer_id", answerId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isRemovingSave = Boolean(existingSave);
  const { error } = isRemovingSave
    ? await supabase
        .from("answer_saves")
        .delete()
        .eq("answer_id", answerId)
        .eq("user_id", user.id)
    : await supabase
        .from("answer_saves")
        .insert({ answer_id: answerId, user_id: user.id });

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  if (!isRemovingSave) {
    await logInteraction(supabase, {
      user_id: user.id,
      interaction_type: "answer_saved",
      question_id: questionId,
      answer_id: answerId,
    });
  }

  revalidatePath(`/questions/${questionId}`);
  // Clean path so a save doesn't leave a stale banner behind (mirrors voting).
  redirect(`/questions/${questionId}`);
}

async function setPreferredAnswer(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();
  const intent = String(formData.get("intent") || "accept");

  if (!questionId) {
    redirect("/");
  }

  if (!answerId) {
    redirect(questionRedirectPath(questionId, "error", "Invalid answer."));
  }

  // RLS already limits question updates to the author; the author_id filter
  // keeps a forged request from silently updating someone else's question.
  const { error } = await supabase
    .from("questions")
    .update({ preferred_answer_id: intent === "clear" ? null : answerId })
    .eq("id", questionId)
    .eq("author_id", user.id);

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  if (intent !== "clear") {
    await logInteraction(supabase, {
      user_id: user.id,
      interaction_type: "preferred_answer_selected",
      question_id: questionId,
      answer_id: answerId,
    });
  }

  revalidatePath(`/questions/${questionId}`);
  revalidatePath("/");
  redirect(
    questionRedirectPath(
      questionId,
      "success",
      intent === "clear" ? "Accepted answer cleared." : "Answer accepted.",
    ),
  );
}

async function submitVerification(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();
  const verdict = String(formData.get("verdict") || "");
  const note = String(formData.get("note") || "").trim();

  if (!questionId) {
    redirect("/");
  }

  if (!answerId || (verdict !== "verified" && verdict !== "disputed")) {
    redirect(questionRedirectPath(questionId, "error", "Invalid verdict."));
  }

  if (note.length > 500) {
    redirect(
      questionRedirectPath(
        questionId,
        "error",
        "Note must be 500 characters or fewer.",
      ),
    );
  }

  // A lecturer must not sit in judgement of their own answer. AI answers have a
  // null author_id, so they stay verifiable.
  const { data: verifiedAnswer } = await supabase
    .from("answers")
    .select("author_id")
    .eq("id", answerId)
    .maybeSingle();

  if (verifiedAnswer?.author_id === user.id) {
    redirect(
      questionRedirectPath(
        questionId,
        "error",
        "You cannot verify your own answer.",
      ),
    );
  }

  // RLS rejects this upsert unless the caller is a verified lecturer.
  const { error } = await supabase
    .from("answer_verifications")
    .upsert(
      { answer_id: answerId, lecturer_id: user.id, note: note || null, verdict },
      { onConflict: "answer_id,lecturer_id" },
    );

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  revalidatePath(`/questions/${questionId}`);
  redirect(
    questionRedirectPath(
      questionId,
      "success",
      verdict === "verified"
        ? "Answer marked as verified."
        : "Answer flagged as disputed.",
    ),
  );
}

async function addComment(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20to%20comment.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const answerId = String(formData.get("answerId") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!questionId) {
    redirect("/");
  }

  if (!answerId || !body) {
    redirect(
      questionRedirectPath(questionId, "error", "Comment cannot be empty."),
    );
  }

  if (body.length > 500) {
    redirect(
      questionRedirectPath(
        questionId,
        "error",
        "Comment must be 500 characters or fewer.",
      ),
    );
  }

  const { error } = await supabase.from("answer_comments").insert({
    answer_id: answerId,
    author_id: user.id,
    body,
  });

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  await logInteraction(supabase, {
    user_id: user.id,
    interaction_type: "comment_created",
    question_id: questionId,
    answer_id: answerId,
  });

  revalidatePath(`/questions/${questionId}`);
  redirect(questionRedirectPath(questionId, "success", "Comment posted."));
}

async function deleteComment(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const questionId = String(formData.get("questionId") || "").trim();
  const commentId = String(formData.get("commentId") || "").trim();

  if (!questionId) {
    redirect("/");
  }

  if (!commentId) {
    redirect(questionRedirectPath(questionId, "error", "Invalid comment."));
  }

  const { error } = await supabase
    .from("answer_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id);

  if (error) {
    redirect(questionRedirectPath(questionId, "error", error.message));
  }

  revalidatePath(`/questions/${questionId}`);
  redirect(questionRedirectPath(questionId, "success", "Comment deleted."));
}

export default async function QuestionDetailPage({
  params,
  searchParams,
}: QuestionPageProps) {
  const { id } = await params;
  const pageMessage = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const fallbackQuestion = fallbackQuestions.find(
    (question) => String(question.id) === id,
  );

  const { data: databaseQuestion } = await supabase
    .from("questions")
    .select(
      "id, author_id, subject_id, preferred_answer_id, title, body, status, view_count, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!databaseQuestion && !fallbackQuestion) {
    notFound();
  }

  if (!databaseQuestion && fallbackQuestion) {
    return (
      <main className="question-page">
        <section className="question-shell">
          <Link className="profile-back" href="/">
            Back to feed
          </Link>

          <article className="question-detail">
            <div className="question-detail-head">
              <div>
                <span className="eyebrow">{fallbackQuestion.subject}</span>
                <h1>{fallbackQuestion.title}</h1>
                <p>
                  {fallbackQuestion.author} | {fallbackQuestion.time}
                </p>
              </div>
              <span className="pill">Prototype sample</span>
            </div>

            <p className="question-body">{fallbackQuestion.preview}</p>

            <div className="tags">
              {fallbackQuestion.tags.map((tag) => (
                <span className="tag" key={tag}>
                  {tag}
                </span>
              ))}
            </div>

            <div className="question-stats">
              <span className="chip">Ans {fallbackQuestion.answers}</span>
              <span className="chip">Votes {fallbackQuestion.votes}</span>
              <span className="chip">Views {fallbackQuestion.views}</span>
            </div>
          </article>

          <section className="question-panel">
            <div className="head">
              <h2>Answers</h2>
              <span className="pill">Preview</span>
            </div>
            <div className="profile-empty">
              <strong>Answer content will load from Supabase later</strong>
              <span>
                This sample question opens correctly now. Once real question
                data exists, this page will render database answers here.
              </span>
            </div>
          </section>

          <section className="question-panel">
            <div className="head">
              <h2>AI Assistant</h2>
              <span className="pill">Next feature</span>
            </div>
            <div className="profile-empty">
              <strong>Chatbot entry point</strong>
              <span>
                This is where the question-aware chatbot panel can be attached
                after the detail page is stable.
              </span>
            </div>
          </section>
        </section>
      </main>
    );
  }

  const question = databaseQuestion as DatabaseQuestion;
  recordQuestionView(supabase, question.id, user?.id ?? null);

  const [
    { data: subject },
    { data: author },
    { data: answers },
    { data: questionTags },
  ] = await Promise.all([
    question.subject_id
      ? supabase
          .from("subjects")
          .select("name")
          .eq("id", question.subject_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("id", question.author_id)
      .maybeSingle(),
    supabase
      .from("answers")
      .select("id, author_id, body, source, score, created_at")
      .eq("question_id", question.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("question_tags")
      .select("tag_id")
      .eq("question_id", question.id),
  ]);

  const tagIds = (questionTags || []).map((item) => item.tag_id);
  const answerRows = (answers || []) as DatabaseAnswer[];
  const answerIds = answerRows.map((answer) => answer.id);

  const [
    { data: tags },
    { data: viewerProfile },
    { data: viewerVotes },
    { data: viewerSaves },
    { data: verifications },
    { data: comments },
  ] = await Promise.all([
    tagIds.length
      ? supabase.from("tags").select("id, name").in("id", tagIds)
      : Promise.resolve({ data: [] }),
    user
      ? supabase
          .from("profiles")
          .select("role, lecturer_status")
          .eq("id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user && answerIds.length
      ? supabase
          .from("answer_votes")
          .select("answer_id, value")
          .eq("voter_id", user.id)
          .in("answer_id", answerIds)
      : Promise.resolve({ data: [] }),
    user && answerIds.length
      ? supabase
          .from("answer_saves")
          .select("answer_id")
          .eq("user_id", user.id)
          .in("answer_id", answerIds)
      : Promise.resolve({ data: [] }),
    answerIds.length
      ? supabase
          .from("answer_verifications")
          .select("id, answer_id, lecturer_id, verdict, note, created_at")
          .in("answer_id", answerIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
    answerIds.length
      ? supabase
          .from("answer_comments")
          .select("id, answer_id, author_id, body, created_at")
          .in("answer_id", answerIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  const verificationRows = (verifications || []) as DatabaseVerification[];
  const commentRows = (comments || []) as DatabaseComment[];
  const voteRows = (viewerVotes || []) as { answer_id: string; value: number }[];

  const profileIds = new Set<string>(
    answerRows
      .map((answer) => answer.author_id)
      .filter((authorId): authorId is string => Boolean(authorId)),
  );
  verificationRows.forEach((verification) =>
    profileIds.add(verification.lecturer_id),
  );
  commentRows.forEach((comment) => profileIds.add(comment.author_id));

  const { data: relatedProfiles } = profileIds.size
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [...profileIds])
    : { data: [] };
  const profilesById = new Map(
    ((relatedProfiles || []) as Profile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

  const displayNameFor = (profileId: string | null) =>
    profileId
      ? profilesById.get(profileId)?.display_name || "Peerly member"
      : "AI assistant";

  const myVoteByAnswer = new Map(
    voteRows.map((vote) => [vote.answer_id, vote.value]),
  );
  const savedAnswerIds = new Set(
    ((viewerSaves || []) as { answer_id: string }[]).map(
      (save) => save.answer_id,
    ),
  );
  const verificationsByAnswer = new Map<string, DatabaseVerification[]>();
  verificationRows.forEach((verification) => {
    const list = verificationsByAnswer.get(verification.answer_id) || [];
    list.push(verification);
    verificationsByAnswer.set(verification.answer_id, list);
  });
  const commentsByAnswer = new Map<string, DatabaseComment[]>();
  commentRows.forEach((comment) => {
    const list = commentsByAnswer.get(comment.answer_id) || [];
    list.push(comment);
    commentsByAnswer.set(comment.answer_id, list);
  });

  const preferredAnswerId = question.preferred_answer_id;
  const isQuestionAuthor = user?.id === question.author_id;
  const isVerifiedLecturer =
    viewerProfile?.role === "lecturer" &&
    viewerProfile?.lecturer_status === "verified";

  const sortedAnswers = [...answerRows].sort((a, b) => {
    if (a.id === preferredAnswerId) return -1;
    if (b.id === preferredAnswerId) return 1;
    return (
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  });

  return (
    <main className="question-page">
      <section className="question-shell">
        <Link className="profile-back" href="/">
          Back to feed
        </Link>

        <article className="question-detail">
          <div className="question-detail-head">
            <div>
              <span className="eyebrow">{subject?.name || "General"}</span>
              <h1>{question.title}</h1>
              <p>
                {(author as Profile | null)?.display_name || "Peerly member"} |{" "}
                {formatDate(question.created_at)}
              </p>
            </div>
            <span className="pill">{question.status}</span>
          </div>

          <p className="question-body">{question.body}</p>

          <div className="tags">
            {(tags || []).map((tag) => (
              <span className="tag" key={tag.id}>
                {tag.name}
              </span>
            ))}
          </div>

          <div className="question-stats">
            <span className="chip">Ans {answerRows.length}</span>
            <span className="chip">Views {question.view_count}</span>
          </div>
        </article>

        <section className="question-panel">
          <div className="head">
            <h2>Answers</h2>
            <span className="pill">{answerRows.length}</span>
          </div>

          {pageMessage.message ? (
            <p
              className="auth-status question-status"
              data-state={pageMessage.status || "info"}
            >
              {pageMessage.message}
            </p>
          ) : null}

          {sortedAnswers.length ? (
            <div className="answer-list">
              {sortedAnswers.map((answer) => {
                const isPreferred = answer.id === preferredAnswerId;
                const myVote = myVoteByAnswer.get(answer.id);
                const isSaved = savedAnswerIds.has(answer.id);
                const answerVerifications =
                  verificationsByAnswer.get(answer.id) || [];
                const answerComments = commentsByAnswer.get(answer.id) || [];
                const isAiAnswer = answer.source === "ai";
                const hasLecturerVerdict = answerVerifications.length > 0;

                return (
                  <article
                    className={`answer-card${isPreferred ? " is-accepted" : ""}`}
                    key={answer.id}
                  >
                    <div className="topline">
                      <div className="meta">
                        <span>{displayNameFor(answer.author_id)}</span>
                        <span>|</span>
                        <span>{isAiAnswer ? "AI tutor" : "Community"}</span>
                      </div>
                      <span>{formatDate(answer.created_at)}</span>
                    </div>

                    {isPreferred || answerVerifications.length || isAiAnswer ? (
                      <div className="answer-badges">
                        {isPreferred ? (
                          <span className="badge badge-accepted">
                            Accepted answer
                          </span>
                        ) : null}
                        {isAiAnswer ? (
                          <span className="badge badge-ai">
                            {hasLecturerVerdict
                              ? "AI answer"
                              : "AI answer — unverified, pending community check"}
                          </span>
                        ) : null}
                        {answerVerifications.map((verification) => (
                          <span
                            className={`badge ${
                              verification.verdict === "verified"
                                ? "badge-verified"
                                : "badge-disputed"
                            }`}
                            key={verification.id}
                          >
                            {verification.verdict === "verified"
                              ? "Verified by lecturer"
                              : "Disputed by lecturer"}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    <p>{answer.body}</p>

                    {answerVerifications
                      .filter((verification) => verification.note)
                      .map((verification) => (
                        <p
                          className={`verification-note ${
                            verification.verdict === "verified"
                              ? "is-verified"
                              : "is-disputed"
                          }`}
                          key={`note-${verification.id}`}
                        >
                          <strong>
                            {displayNameFor(verification.lecturer_id)}:
                          </strong>{" "}
                          {verification.note}
                        </p>
                      ))}

                    <div className="answer-actions">
                      <form action={voteOnAnswer} className="vote-controls">
                        <input
                          name="questionId"
                          type="hidden"
                          value={question.id}
                        />
                        <input
                          name="answerId"
                          type="hidden"
                          value={answer.id}
                        />
                        <button
                          aria-label="Upvote"
                          className={`vote-btn${myVote === 1 ? " is-active" : ""}`}
                          name="value"
                          title={user ? "Upvote" : "Sign in to vote"}
                          type="submit"
                          value="1"
                        >
                          ▲
                        </button>
                        <span className="vote-score">{answer.score}</span>
                        <button
                          aria-label="Downvote"
                          className={`vote-btn${myVote === -1 ? " is-active" : ""}`}
                          name="value"
                          title={user ? "Downvote" : "Sign in to vote"}
                          type="submit"
                          value="-1"
                        >
                          ▼
                        </button>
                      </form>

                      <form action={toggleSaveAnswer} className="save-controls">
                        <input
                          name="questionId"
                          type="hidden"
                          value={question.id}
                        />
                        <input
                          name="answerId"
                          type="hidden"
                          value={answer.id}
                        />
                        <button
                          aria-label={isSaved ? "Unsave answer" : "Save answer"}
                          aria-pressed={isSaved}
                          className={`btn save-btn${isSaved ? " is-active" : ""}`}
                          title={
                            user
                              ? isSaved
                                ? "Unsave answer"
                                : "Save answer"
                              : "Sign in to save"
                          }
                          type="submit"
                        >
                          {isSaved ? "★ Saved" : "☆ Save"}
                        </button>
                      </form>

                      {isQuestionAuthor ? (
                        <form action={setPreferredAnswer}>
                          <input
                            name="questionId"
                            type="hidden"
                            value={question.id}
                          />
                          <input
                            name="answerId"
                            type="hidden"
                            value={answer.id}
                          />
                          <input
                            name="intent"
                            type="hidden"
                            value={isPreferred ? "clear" : "accept"}
                          />
                          <button className="btn accept-btn" type="submit">
                            {isPreferred
                              ? "Unaccept answer"
                              : "Accept this answer"}
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {isVerifiedLecturer ? (
                      <form action={submitVerification} className="verify-form">
                        <input
                          name="questionId"
                          type="hidden"
                          value={question.id}
                        />
                        <input
                          name="answerId"
                          type="hidden"
                          value={answer.id}
                        />
                        <input
                          className="verify-note-input"
                          maxLength={500}
                          name="note"
                          placeholder="Optional note shown with your verdict"
                          type="text"
                        />
                        <div className="verify-actions">
                          <button
                            className="btn verify-btn"
                            name="verdict"
                            type="submit"
                            value="verified"
                          >
                            Verify as correct
                          </button>
                          <button
                            className="btn dispute-btn"
                            name="verdict"
                            type="submit"
                            value="disputed"
                          >
                            Flag as incorrect
                          </button>
                        </div>
                      </form>
                    ) : null}

                    <div className="comment-thread">
                      {answerComments.length ? (
                        <ul className="comment-list">
                          {answerComments.map((comment) => (
                            <li className="comment-item" key={comment.id}>
                              <div className="comment-content">
                                <span className="comment-meta">
                                  <strong>
                                    {displayNameFor(comment.author_id)}
                                  </strong>{" "}
                                  | {formatDate(comment.created_at)}
                                </span>
                                <p>{comment.body}</p>
                              </div>
                              {user?.id === comment.author_id ? (
                                <form action={deleteComment}>
                                  <input
                                    name="questionId"
                                    type="hidden"
                                    value={question.id}
                                  />
                                  <input
                                    name="commentId"
                                    type="hidden"
                                    value={comment.id}
                                  />
                                  <button
                                    aria-label="Delete comment"
                                    className="comment-delete"
                                    type="submit"
                                  >
                                    Delete
                                  </button>
                                </form>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {user ? (
                        <form action={addComment} className="comment-form">
                          <input
                            name="questionId"
                            type="hidden"
                            value={question.id}
                          />
                          <input
                            name="answerId"
                            type="hidden"
                            value={answer.id}
                          />
                          <input
                            maxLength={500}
                            name="body"
                            placeholder="Add a comment: correct, clarify, or add insight"
                            required
                            type="text"
                          />
                          <button className="btn comment-submit" type="submit">
                            Comment
                          </button>
                        </form>
                      ) : (
                        <p className="comment-signin">
                          Sign in to join the discussion.
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="profile-empty">
              <strong>No answers yet</strong>
              <span>
                User and AI answers for this question will appear here once they
                are created.
              </span>
            </div>
          )}

          {user ? (
            <form action={createAnswer} className="answer-form">
              <input name="questionId" type="hidden" value={question.id} />
              <label htmlFor="answerBody">Share an answer</label>
              <textarea
                id="answerBody"
                minLength={10}
                name="body"
                placeholder="Explain your approach, steps, or reasoning."
                required
                rows={5}
              />
              <button className="btn primary" type="submit">
                Post answer
              </button>
            </form>
          ) : (
            <div className="banner">
              <strong>Sign in to answer</strong>
              <span>
                You can read this thread now. Posting an answer requires a
                Peerly account.
              </span>
            </div>
          )}
        </section>

        <section className="question-panel">
          <div className="head">
            <h2>AI Assistant</h2>
          </div>
          <div className="ai-assistant-card">
            <p>
              Get instant 1:1 tutoring on this question. AI answers are drafts
              until the community verifies them.
            </p>
            <Link
              className="btn primary"
              href={
                user
                  ? `/tutor?question=${question.id}`
                  : "/login?status=info&message=Please%20sign%20in%20to%20use%20the%20AI%20tutor."
              }
            >
              Ask the AI tutor
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
