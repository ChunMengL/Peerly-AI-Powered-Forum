import type { Json } from "@/lib/supabase/database.types";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateMockTutorReply } from "@/lib/tutorMock";
import type {
  TutorHistoryMessage,
  TutorProfile,
  TutorRequest,
  TutorResult,
} from "@/lib/tutor.types";

// The model generates at roughly 10-25 tokens/second depending on what else is
// using the GPU, so a long reply needs well over ten seconds. Timing out here
// falls back to the mock silently, which is worse than waiting.
const MODEL_SERVER_TIMEOUT_MS = 30_000;

const SKILL_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const EXPLANATION_STYLES = new Set([
  "step_by_step",
  "conceptual",
  "worked_examples",
  "concise",
]);

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

function asPreferencesObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

/** Reads the caller's profile into the frozen tutor contract shape. */
export async function loadTutorProfile(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<TutorProfile> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("skill_level, preferences")
    .eq("id", userId)
    .maybeSingle();

  const preferences = asPreferencesObject(profile?.preferences);
  const skillLevel = profile?.skill_level;
  const explanationStyle = preferences.explanation_style;
  const goal = preferences.goal;

  return {
    skill_level:
      typeof skillLevel === "string" && SKILL_LEVELS.has(skillLevel)
        ? (skillLevel as TutorProfile["skill_level"])
        : null,
    explanation_style:
      typeof explanationStyle === "string" &&
      EXPLANATION_STYLES.has(explanationStyle)
        ? (explanationStyle as TutorProfile["explanation_style"])
        : null,
    goal: typeof goal === "string" && goal.trim() ? goal.trim() : null,
  };
}

/**
 * Produces the tutor's next turn. Forwards the frozen-contract payload to the
 * model server when MODEL_SERVER_URL is set; on any failure (unset, network
 * error, timeout, malformed reply) it degrades to the local deterministic mock
 * so the product flow always works. MODEL_SERVER_URL never reaches the client.
 */
export async function generateTutorReply(
  question: string,
  history: TutorHistoryMessage[],
  profile: TutorProfile,
): Promise<TutorResult> {
  const payload: TutorRequest = { question, history, profile };
  const baseUrl = process.env.MODEL_SERVER_URL?.trim();

  if (baseUrl) {
    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/tutor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(MODEL_SERVER_TIMEOUT_MS),
        cache: "no-store",
      });

      if (response.ok) {
        const data: unknown = await response.json();
        const reply =
          data && typeof data === "object" && !Array.isArray(data)
            ? (data as { reply?: unknown }).reply
            : undefined;
        if (typeof reply === "string" && reply.trim()) {
          return { reply, mock: false };
        }
      }
    } catch {
      // Fall through to the mock; the tutor must keep working without the model.
    }
  }

  return {
    reply: generateMockTutorReply(question, history, profile),
    mock: true,
  };
}
