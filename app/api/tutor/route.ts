import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateTutorReply, loadTutorProfile } from "@/lib/tutor";
import type { TutorHistoryMessage } from "@/lib/tutor.types";

// Generation on the model server can take tens of seconds; without this the
// platform default cuts the request off long before MODEL_SERVER_TIMEOUT_MS.
export const maxDuration = 60;

const MAX_HISTORY_TURNS = 20;

type TutorPayload = {
  question?: unknown;
  history?: unknown;
};

function parseHistory(value: unknown): TutorHistoryMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const history: TutorHistoryMessage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const { role, content } = item as { role?: unknown; content?: unknown };
    if (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim()
    ) {
      history.push({ role, content });
    }
  }
  return history.slice(-MAX_HISTORY_TURNS);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  // A missing/expired session surfaces as an error here; both mean 401.
  const user = userData.user;
  if (userError || !user) {
    return NextResponse.json(
      { error: "Authentication is required to use the AI tutor." },
      { status: 401 },
    );
  }

  let payload: TutorPayload;
  try {
    payload = (await request.json()) as TutorPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question =
    typeof payload.question === "string" ? payload.question.trim() : "";
  if (!question) {
    return NextResponse.json(
      { error: "A question is required." },
      { status: 400 },
    );
  }

  const history = parseHistory(payload.history);
  const profile = await loadTutorProfile(supabase, user.id);
  const result = await generateTutorReply(question, history, profile);

  return NextResponse.json(result);
}
