// Frozen contract shared with the Python model server. Do not rename fields.

export type TutorHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TutorProfile = {
  skill_level: "beginner" | "intermediate" | "advanced" | null;
  explanation_style:
    | "step_by_step"
    | "conceptual"
    | "worked_examples"
    | "concise"
    | null;
  goal: string | null;
};

export type TutorRequest = {
  question: string;
  history: TutorHistoryMessage[];
  profile: TutorProfile;
};

export type TutorResult = {
  reply: string;
  /** True when the reply came from the local stub instead of the model server. */
  mock: boolean;
};
