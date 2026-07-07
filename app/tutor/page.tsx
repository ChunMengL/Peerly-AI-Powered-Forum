import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { startConversation } from "./actions";

export const dynamic = "force-dynamic";

type TutorPageProps = {
  searchParams: Promise<{
    question?: string;
    status?: string;
    message?: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default async function TutorPage({ searchParams }: TutorPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?status=info&message=Please%20sign%20in%20to%20use%20the%20AI%20tutor.",
    );
  }

  const questionId = params.question?.trim() || "";
  let composerPrefill = "";
  let linkedQuestionTitle = "";

  if (questionId) {
    // Reopen the existing tutoring thread for this question instead of
    // creating a duplicate; the conversation is created on first send.
    const { data: existingConversation } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("question_id", questionId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingConversation) {
      redirect(`/tutor/${existingConversation.id}`);
    }

    const { data: question } = await supabase
      .from("questions")
      .select("id, title, body")
      .eq("id", questionId)
      .maybeSingle();

    if (!question) {
      redirect(
        "/tutor?status=error&message=That%20question%20could%20not%20be%20found.",
      );
    }

    const { data: questionTags } = await supabase
      .from("question_tags")
      .select("tag_id")
      .eq("question_id", questionId);
    const tagIds = (questionTags || []).map((item) => item.tag_id);
    const { data: tags } = tagIds.length
      ? await supabase.from("tags").select("name").in("id", tagIds)
      : { data: [] };
    const tagNames = (tags || []).map((tag) => tag.name);

    linkedQuestionTitle = question.title;
    composerPrefill = [
      question.title,
      question.body,
      tagNames.length ? `Tags: ${tagNames.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const { data: conversations } = await supabase
    .from("ai_conversations")
    .select("id, title, question_id, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const conversationRows = conversations || [];
  const usingStubModel = !process.env.MODEL_SERVER_URL?.trim();

  return (
    <main className="tutor-page">
      <section className="tutor-shell">
        <Link className="profile-back" href="/">
          Back to feed
        </Link>

        <div className="tutor-layout">
          <aside className="tutor-sidebar">
            <div className="head">
              <h2>Conversations</h2>
              <span className="pill">{conversationRows.length}</span>
            </div>
            <Link className="btn new-conversation-btn" href="/tutor">
              New conversation
            </Link>
            {conversationRows.length ? (
              <ul className="conversation-list">
                {conversationRows.map((conversation) => (
                  <li key={conversation.id}>
                    <Link
                      className="conversation-link"
                      href={`/tutor/${conversation.id}`}
                    >
                      <strong>{conversation.title || "New conversation"}</strong>
                      <span>
                        {conversation.question_id ? "Linked to question | " : ""}
                        {formatDate(conversation.updated_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tutor-sidebar-empty">
                No conversations yet. Ask your first question below.
              </p>
            )}
          </aside>

          <section className="question-panel tutor-main">
            <div className="head">
              <h2>AI Tutor</h2>
              {usingStubModel ? (
                <span className="pill" title="MODEL_SERVER_URL is not set">
                  Stub model
                </span>
              ) : null}
            </div>

            <p className="tutor-intro">
              Get instant 1:1 tutoring tuned to your skill level and preferred
              explanation style. Every AI reply is a draft until the community
              verifies it.
            </p>

            {params.message ? (
              <p
                className="auth-status question-status"
                data-state={params.status || "info"}
              >
                {params.message}
              </p>
            ) : null}

            {linkedQuestionTitle ? (
              <p className="tutor-linked-note">
                Starting a conversation about:{" "}
                <Link href={`/questions/${questionId}`}>
                  <strong>{linkedQuestionTitle}</strong>
                </Link>
              </p>
            ) : null}

            <form action={startConversation} className="chat-composer">
              {questionId ? (
                <input name="questionId" type="hidden" value={questionId} />
              ) : null}
              <label htmlFor="tutorMessage">
                What would you like help with?
              </label>
              <textarea
                defaultValue={composerPrefill}
                id="tutorMessage"
                name="body"
                placeholder="Describe the problem you are working on, or paste a question."
                required
                rows={composerPrefill ? 8 : 4}
              />
              <button className="btn primary" type="submit">
                Start tutoring session
              </button>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
