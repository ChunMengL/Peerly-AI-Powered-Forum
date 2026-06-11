import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InteractionType, Json } from "@/lib/supabase/database.types";

const SUPPORTED_INTERACTIONS = new Set<InteractionType>([
  "question_viewed",
  "search_performed",
  "tag_clicked",
  "answer_posted",
  "answer_created",
  "recommendation_clicked",
]);

type InteractionPayload = {
  type?: string;
  interaction_type?: string;
  question_id?: string;
  questionId?: string;
  answer_id?: string;
  answerId?: string;
  tag_id?: string;
  tagId?: string;
  metadata?: Json;
};

function isPlainJsonObject(value: Json | undefined): value is Record<string, Json> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 500 });
  }

  const user = userData.user;
  if (!user) {
    return NextResponse.json(
      { error: "Authentication is required to record interactions." },
      { status: 401 },
    );
  }

  let payload: InteractionPayload;
  try {
    payload = (await request.json()) as InteractionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const interactionType = payload.interaction_type || payload.type;
  if (
    !interactionType ||
    !SUPPORTED_INTERACTIONS.has(interactionType as InteractionType)
  ) {
    return NextResponse.json(
      {
        error:
          "Unsupported interaction type. Use question_viewed, search_performed, tag_clicked, answer_posted, answer_created, or recommendation_clicked.",
      },
      { status: 400 },
    );
  }

  const metadata = isPlainJsonObject(payload.metadata) ? payload.metadata : {};
  const { data, error } = await supabase
    .from("user_interactions")
    .insert({
      user_id: user.id,
      interaction_type: interactionType as InteractionType,
      question_id: payload.question_id || payload.questionId || null,
      answer_id: payload.answer_id || payload.answerId || null,
      tag_id: payload.tag_id || payload.tagId || null,
      metadata,
    })
    .select("id, interaction_type, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    {
      interaction: data,
    },
    { status: 201 },
  );
}
