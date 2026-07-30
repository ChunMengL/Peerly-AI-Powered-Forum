"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { InteractionType, Json } from "@/lib/supabase/database.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTutorReply, loadTutorProfile } from "@/lib/tutor";
import type { TutorHistoryMessage } from "@/lib/tutor.types";

const MAX_HISTORY_TURNS = 20;
const TITLE_MAX_LENGTH = 60;

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

function conversationTitleFrom(message: string) {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > TITLE_MAX_LENGTH
    ? `${clean.slice(0, TITLE_MAX_LENGTH - 1).trimEnd()}…`
    : clean;
}

function tutorRedirect(
  path: string,
  status: "success" | "error" | "info",
  message: string,
): never {
  const params = new URLSearchParams({ status, message });
  redirect(`${path}?${params.toString()}`);
}

async function logInteraction(
  supabase: SupabaseServerClient,
  interaction: {
    user_id: string;
    interaction_type: InteractionType;
    question_id?: string;
    answer_id?: string;
    metadata?: Json;
  },
) {
  // Best-effort ranking signal for Phase 3; a failure here must not block the action.
  await supabase.from("user_interactions").insert(interaction);
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      "/login?status=info&message=Please%20sign%20in%20to%20use%20the%20AI%20tutor.",
    );
  }

  return { supabase, user };
}

export async function startConversation(formData: FormData) {
  const { supabase, user } = await requireUser();

  const body = String(formData.get("body") || "").trim();
  const questionId = String(formData.get("questionId") || "").trim();
  const basePath = questionId ? `/tutor?question=${questionId}&` : "/tutor?";

  if (!body) {
    redirect(
      `${basePath}${new URLSearchParams({
        status: "error",
        message: "Type a message to start the conversation.",
      }).toString()}`,
    );
  }

  const { data: conversation, error: conversationError } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: user.id,
      question_id: questionId || null,
      title: conversationTitleFrom(body),
    })
    .select("id")
    .single();

  if (conversationError || !conversation) {
    redirect(
      `${basePath}${new URLSearchParams({
        status: "error",
        message: conversationError?.message || "Could not start conversation.",
      }).toString()}`,
    );
  }

  const { error: messageError } = await supabase.from("ai_messages").insert({
    conversation_id: conversation.id,
    role: "user",
    content: body,
  });

  if (messageError) {
    tutorRedirect(`/tutor/${conversation.id}`, "error", messageError.message);
  }

  const profile = await loadTutorProfile(supabase, user.id);
  const result = await generateTutorReply(body, [], profile);

  const { error: replyError } = await supabase.from("ai_messages").insert({
    conversation_id: conversation.id,
    role: "assistant",
    content: result.reply,
    is_mock: result.mock,
  });

  if (replyError) {
    tutorRedirect(`/tutor/${conversation.id}`, "error", replyError.message);
  }

  await logInteraction(supabase, {
    user_id: user.id,
    interaction_type: "ai_requested",
    ...(questionId ? { question_id: questionId } : {}),
    metadata: { conversation_id: conversation.id, mock: result.mock },
  });

  revalidatePath("/tutor");
  redirect(`/tutor/${conversation.id}`);
}

export async function sendMessage(formData: FormData) {
  const { supabase, user } = await requireUser();

  const conversationId = String(formData.get("conversationId") || "").trim();
  const body = String(formData.get("body") || "").trim();

  if (!conversationId) {
    redirect("/tutor");
  }

  const threadPath = `/tutor/${conversationId}`;

  if (!body) {
    tutorRedirect(threadPath, "error", "Type a message before sending.");
  }

  // RLS scopes the lookup to the owner, so this doubles as the ownership check.
  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, question_id, title")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    tutorRedirect("/tutor", "error", "Conversation not found.");
  }

  const { data: userMessage, error: messageError } = await supabase
    .from("ai_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content: body,
    })
    .select("id")
    .single();

  if (messageError || !userMessage) {
    tutorRedirect(
      threadPath,
      "error",
      messageError?.message || "Could not send the message.",
    );
  }

  // History reflects the committed thread minus the message just inserted —
  // that one travels to the model as `question`, not as history.
  const { data: priorMessages } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .neq("id", userMessage.id)
    .order("created_at", { ascending: true });

  const history: TutorHistoryMessage[] = (priorMessages || [])
    .filter(
      (message): message is TutorHistoryMessage =>
        message.role === "user" || message.role === "assistant",
    )
    .slice(-MAX_HISTORY_TURNS);

  const profile = await loadTutorProfile(supabase, user.id);
  const result = await generateTutorReply(body, history, profile);

  const { error: replyError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: result.reply,
    is_mock: result.mock,
  });

  if (replyError) {
    tutorRedirect(threadPath, "error", replyError.message);
  }

  // Bump the conversation so the list sorts by recent activity; the
  // set_updated_at trigger stamps updated_at on any update.
  await supabase
    .from("ai_conversations")
    .update({ title: conversation.title || conversationTitleFrom(body) })
    .eq("id", conversationId);

  await logInteraction(supabase, {
    user_id: user.id,
    interaction_type: "ai_requested",
    ...(conversation.question_id
      ? { question_id: conversation.question_id }
      : {}),
    metadata: { conversation_id: conversationId, mock: result.mock },
  });

  revalidatePath(threadPath);
  revalidatePath("/tutor");
  redirect(threadPath);
}

export async function publishAnswer(formData: FormData) {
  const { supabase, user } = await requireUser();

  const conversationId = String(formData.get("conversationId") || "").trim();

  if (!conversationId) {
    redirect("/tutor");
  }

  const threadPath = `/tutor/${conversationId}`;

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id, question_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) {
    tutorRedirect("/tutor", "error", "Conversation not found.");
  }

  const questionId = conversation.question_id;
  if (!questionId) {
    tutorRedirect(
      threadPath,
      "error",
      "This conversation is not linked to a question.",
    );
  }

  // The whole exchange is posted, not a single reply. A lone final answer gives
  // the community a conclusion with no working to check, which is the opposite
  // of treating AI output as a draft that has to be verified.
  const { data: conversationMessages } = await supabase
    .from("ai_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const transcript = (conversationMessages || []).filter(
    (item) => item.role !== "system",
  );
  const lastAssistant = [...transcript]
    .reverse()
    .find((item) => item.role === "assistant");

  if (!lastAssistant) {
    tutorRedirect(
      threadPath,
      "error",
      "This conversation has no AI reply to post yet.",
    );
  }

  const firstUserMessage = transcript.find((item) => item.role === "user");
  const transcriptBody = transcript
    .map(
      (item) =>
        `${item.role === "assistant" ? "AI tutor" : "Student"}: ${item.content}`,
    )
    .join("\n\n");

  // One shared transcript per conversation. Without this, continuing the chat
  // and sharing again would post a second, near-duplicate answer.
  const { data: alreadyShared } = await supabase
    .from("ai_response_drafts")
    .select("id")
    .eq("conversation_id", conversationId)
    .not("published_answer_id", "is", null)
    .limit(1);

  if (alreadyShared?.length) {
    tutorRedirect(
      threadPath,
      "info",
      "This conversation has already been posted as an answer.",
    );
  }

  // Each assistant message owns at most one draft (ai_drafts_one_per_message),
  // so the last reply's id is the double-publish guard for the transcript.
  const messageId = lastAssistant.id;
  const { data: existingDrafts } = await supabase
    .from("ai_response_drafts")
    .select("id, published_answer_id")
    .eq("message_id", messageId)
    .limit(1);

  let draftId = existingDrafts?.[0]?.id;

  if (existingDrafts?.[0]?.published_answer_id) {
    tutorRedirect(
      threadPath,
      "info",
      "This conversation has already been posted as an answer.",
    );
  }

  if (!draftId) {
    const { data: draft, error: draftError } = await supabase
      .from("ai_response_drafts")
      .insert({
        user_id: user.id,
        question_id: questionId,
        conversation_id: conversationId,
        message_id: messageId,
        prompt: firstUserMessage?.content || "",
        response: transcriptBody,
      })
      .select("id")
      .single();

    if (draftError || !draft) {
      // A unique violation means a concurrent publish already created the
      // draft for this message — surface it as the already-posted path.
      if (draftError?.code === "23505") {
        tutorRedirect(
          threadPath,
          "info",
          "This conversation has already been posted as an answer.",
        );
      }
      tutorRedirect(
        threadPath,
        "error",
        draftError?.message || "Could not save the AI draft.",
      );
    }

    draftId = draft.id;
  }

  const { data: answer, error: answerError } = await supabase
    .from("answers")
    .insert({
      question_id: questionId,
      author_id: user.id,
      source: "ai",
      body: transcriptBody,
      ai_draft_id: draftId,
    })
    .select("id")
    .single();

  if (answerError || !answer) {
    tutorRedirect(
      threadPath,
      "error",
      answerError?.message || "Could not post the answer.",
    );
  }

  const { error: publishError } = await supabase
    .from("ai_response_drafts")
    .update({
      published_answer_id: answer.id,
      published_at: new Date().toISOString(),
    })
    .eq("id", draftId);

  if (publishError) {
    tutorRedirect(threadPath, "error", publishError.message);
  }

  await logInteraction(supabase, {
    user_id: user.id,
    interaction_type: "answer_posted",
    question_id: questionId,
    answer_id: answer.id,
    metadata: { source: "ai", draft_id: draftId, conversation_id: conversationId },
  });

  revalidatePath(`/questions/${questionId}`);
  revalidatePath(threadPath);
  revalidatePath("/");

  const params = new URLSearchParams({
    status: "success",
    message:
      "AI answer posted. It stays marked unverified until the community checks it.",
  });
  redirect(`/questions/${questionId}?${params.toString()}`);
}
