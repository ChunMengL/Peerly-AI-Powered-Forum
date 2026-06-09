import Link from "next/link";
import { notFound } from "next/navigation";
import { questions as fallbackQuestions } from "@/lib/questions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type QuestionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type DatabaseQuestion = {
  id: string;
  author_id: string;
  subject_id: string | null;
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

type Profile = {
  id: string;
  display_name: string | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function QuestionDetailPage({
  params,
}: QuestionPageProps) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const fallbackQuestion = fallbackQuestions.find(
    (question) => String(question.id) === id,
  );

  const { data: databaseQuestion } = await supabase
    .from("questions")
    .select(
      "id, author_id, subject_id, title, body, status, view_count, created_at",
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
  const { data: tags } = tagIds.length
    ? await supabase.from("tags").select("id, name").in("id", tagIds)
    : { data: [] };
  const answerRows = (answers || []) as DatabaseAnswer[];
  const answerAuthorIds = [
    ...new Set(
      answerRows
        .map((answer) => answer.author_id)
        .filter((authorId): authorId is string => Boolean(authorId)),
    ),
  ];
  const { data: answerProfiles } = answerAuthorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", answerAuthorIds)
    : { data: [] };
  const profilesById = new Map(
    ((answerProfiles || []) as Profile[]).map((profile) => [
      profile.id,
      profile,
    ]),
  );

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
          {answerRows.length ? (
            <div className="answer-list">
              {answerRows.map((answer) => (
                <article className="answer-card" key={answer.id}>
                  <div className="topline">
                    <div className="meta">
                      <span>
                        {answer.author_id
                          ? profilesById.get(answer.author_id)?.display_name ||
                            "Peerly member"
                          : "AI assistant"}
                      </span>
                      <span>|</span>
                      <span>{answer.source}</span>
                    </div>
                    <span>{formatDate(answer.created_at)}</span>
                  </div>
                  <p>{answer.body}</p>
                  <span className="chip">Score {answer.score}</span>
                </article>
              ))}
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
        </section>

        <section className="question-panel">
          <div className="head">
            <h2>AI Assistant</h2>
            <span className="pill">Planned</span>
          </div>
          <div className="profile-empty">
            <strong>Question-aware chatbot slot</strong>
            <span>
              The chatbot can use this question title, body, tags, and answers
              as context when the AI backend is implemented.
            </span>
          </div>
        </section>
      </section>
    </main>
  );
}
