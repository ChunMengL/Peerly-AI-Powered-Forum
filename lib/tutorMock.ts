import type {
  TutorHistoryMessage,
  TutorProfile,
} from "@/lib/tutor.types";

const STYLE_OPENERS: Record<string, string> = {
  step_by_step: "Let's take it step by step.",
  conceptual: "Let's build the intuition first before touching any mechanics.",
  worked_examples: "Let's anchor this in a concrete worked example.",
  concise: "Here's the short version.",
};

const SKILL_FRAMES: Record<string, string> = {
  beginner:
    "I'll keep the jargon light and build each idea from the ground up.",
  intermediate:
    "I'll assume you know the fundamentals and focus on the reasoning.",
  advanced:
    "I'll skip the basics and go straight to the subtle parts most people miss.",
};

function truncate(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/**
 * Deterministic stand-in for the fine-tuned tutor model. It mirrors the shape
 * of a real tutoring turn (frame, restated question, guiding moves, check for
 * understanding) and visibly changes with the caller's profile so
 * personalization can be demonstrated before the model server exists.
 */
export function generateMockTutorReply(
  question: string,
  history: TutorHistoryMessage[],
  profile: TutorProfile,
): string {
  const opener =
    (profile.explanation_style && STYLE_OPENERS[profile.explanation_style]) ||
    "Let's work through this together.";
  const skillFrame =
    (profile.skill_level && SKILL_FRAMES[profile.skill_level]) ||
    "Tell me how familiar this topic feels so I can pitch things right.";
  const continuity = history.length
    ? "Building on what we've covered so far: "
    : "";
  const restated = truncate(question, 160);

  const parts = [
    `${opener} ${skillFrame}`,
    `${continuity}You're asking: "${restated}"`,
    "Before I hand you an answer, a guiding question: what do you already know about the pieces involved here, and which piece feels least certain?",
    "Hint: start by isolating the one concept the question actually hinges on — most of the difficulty usually lives in a single step, not the whole problem.",
    "Quick check for understanding: if I changed one detail of the problem, could you predict how the outcome changes? Try it and tell me what you get.",
  ];

  if (profile.goal) {
    parts.push(
      `Keeping your goal in mind — "${truncate(profile.goal, 120)}" — mastering this piece moves you directly toward it.`,
    );
  }

  return parts.join("\n\n");
}
