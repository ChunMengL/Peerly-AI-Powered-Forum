import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { publishAnswer, sendMessage } from "../actions";

export const dynamic = "force-dynamic";
// sendMessage waits on model generation; see lib/tutor.ts.
export const maxDuration = 60;

type ConversationPageProps = {
  params: Promise<{
    conversationId: string;
  }>;
  searchParams: Promise<{
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

export default async function ConversationPage({
  params,
  searchParams,
}: ConversationPageProps) {
  const { conversationId } = await params;
  const pageMessage = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?status=info&message=Please%20sign%20in%20to%20use%20the%20AI%20tutor.",
    );
  }

  // RLS scopes this to the owner, so other users' conversations 404.
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, title, question_id, created_at")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    notFound();
  }

  const [
    { data: messages },
    { data: linkedQuestion },
    { data: publishedDrafts },
    { data: conversations },
  ] = await Promise.all([
    supabase
      .from("ai_messages")
      .select("id, role, content, is_mock, created_at")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    conversation.question_id
      ? supabase
          .from("questions")
          .select("id, title")
          .eq("id", conversation.question_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.question_id
      ? supabase
          .from("ai_response_drafts")
          .select("message_id, published_answer_id")
          .eq("conversation_id", conversation.id)
          .not("published_answer_id", "is", null)
      : Promise.resolve({ data: [] }),
    supabase
      .from("ai_conversations")
      .select("id, title, question_id, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
  ]);

  const visibleMessages = (messages || []).filter(
    (message) => message.role !== "system",
  );
  // The whole conversation is shared as one answer, so this is a single flag
  // rather than a per-message set.
  const alreadyShared = (publishedDrafts || []).length > 0;
  const conversationRows = conversations || [];
  const usingStubModel = !process.env.MODEL_SERVER_URL?.trim();

  return (
    <main className="tutor-page is-conversation">
      <section className="tutor-shell">
        <Link className="profile-back" href="/tutor">
          All conversations
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
            <ul className="conversation-list">
              {conversationRows.map((item) => (
                <li key={item.id}>
                  <Link
                    className={`conversation-link${
                      item.id === conversation.id ? " is-active" : ""
                    }`}
                    href={`/tutor/${item.id}`}
                  >
                    <strong>{item.title || "New conversation"}</strong>
                    <span>
                      {item.question_id ? "Linked to question | " : ""}
                      {formatDate(item.updated_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <section className="question-panel tutor-main">
            <div className="head">
              <h2>{conversation.title || "New conversation"}</h2>
              {usingStubModel ? (
                <span className="pill" title="MODEL_SERVER_URL is not set">
                  Stub model
                </span>
              ) : null}
            </div>

            {linkedQuestion ? (
              <p className="tutor-linked-note">
                Tutoring on:{" "}
                <Link href={`/questions/${linkedQuestion.id}`}>
                  <strong>{linkedQuestion.title}</strong>
                </Link>
              </p>
            ) : null}

            {pageMessage.message ? (
              <p
                className="auth-status question-status"
                data-state={pageMessage.status || "info"}
              >
                {pageMessage.message}
              </p>
            ) : null}

            <div className="chat-thread">
              {visibleMessages.map((message) => {
                const isAssistant = message.role === "assistant";

                return (
                  <div
                    className={`chat-message ${
                      isAssistant ? "is-assistant" : "is-user"
                    }`}
                    key={message.id}
                  >
                    {isAssistant ? (
                      <span className="ai-draft-label">
                        AI draft — unverified
                        {message.is_mock ? (
                          <span
                            className="pill"
                            title="Reply generated by the local stub model"
                          >
                            Stub model
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    <div className="chat-bubble">
                      <p>{message.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {conversation.question_id ? (
              <div className="share-conversation">
                {alreadyShared ? (
                  <span className="publish-done">
                    This conversation has been posted to the question
                  </span>
                ) : (
                  <form action={publishAnswer}>
                    <input
                      name="conversationId"
                      type="hidden"
                      value={conversation.id}
                    />
                    <SubmitButton
                      className="btn publish-btn"
                      pendingLabel="Posting…"
                    >
                      Post this conversation as an answer
                    </SubmitButton>
                    <span>
                      Posts the whole exchange, so the community can check every
                      step rather than a final answer on its own.
                    </span>
                  </form>
                )}
              </div>
            ) : null}

            <form action={sendMessage} className="chat-composer">
              <input
                name="conversationId"
                type="hidden"
                value={conversation.id}
              />
              <label htmlFor="chatMessage">Your message</label>
              <textarea
                id="chatMessage"
                name="body"
                placeholder="Ask a follow-up, try an answer, or request another hint."
                required
                rows={3}
              />
              <SubmitButton className="btn primary" pendingLabel="Thinking…">
                Send
              </SubmitButton>
            </form>
          </section>
        </div>
      </section>
    </main>
  );
}
