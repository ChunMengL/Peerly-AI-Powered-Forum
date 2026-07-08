export type RecommendationQuestion = {
  id: string;
  title: string;
  subjectId: string | null;
  subject: string;
  tags: string[];
  viewCount: number;
  createdAt: string;
};

export type RecommendationPreferences = {
  subjectIds?: string[];
  tagNames?: string[];
  subjectAffinities?: Record<string, number>;
  tagAffinities?: Record<string, number>;
  activityBased?: boolean;
};

export type RecommendationResult = {
  id: string;
  title: string;
  subject: string;
  tags: string[];
  score: number;
  reason: "Similar subject" | "Matching tags" | "Based on your recent activity" | "Recent and popular";
};

type ScoredQuestion = RecommendationResult & {
  createdAtMs: number;
};

const SUBJECT_WEIGHT = 0.45;
const TAG_WEIGHT = 0.4;
const POPULAR_WEIGHT = 0.1;
const RECENT_WEIGHT = 0.05;

// How strongly each interaction type signals interest. Applied per event,
// then decayed by 0.5^(ageDays / INTERACTION_HALF_LIFE_DAYS) before being
// accumulated into the user's subject/tag interest profile.
export const INTERACTION_WEIGHTS: Record<string, number> = {
  preferred_answer_selected: 5,
  answer_saved: 4,
  vote_cast: 3,
  comment_created: 3,
  answer_created: 3,
  answer_posted: 3,
  ai_requested: 2,
  question_created: 2,
  question_viewed: 1,
  search_performed: 1,
};

export const INTERACTION_HALF_LIFE_DAYS = 7;

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function normalizeScore(value: number) {
  return Number(Math.min(1, Math.max(0, value)).toFixed(2));
}

function clampAffinity(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function scoreRecommendations({
  questions,
  preferences,
  limit = 10,
}: {
  questions: RecommendationQuestion[];
  preferences: RecommendationPreferences;
  limit?: number;
}) {
  // Affinities are in (0, 1]. Set-based preferences remain supported and
  // count as full-strength interest (affinity 1).
  const subjectAffinities = new Map<string, number>();
  for (const [subjectId, affinity] of Object.entries(
    preferences.subjectAffinities || {},
  )) {
    if (affinity > 0) {
      subjectAffinities.set(
        subjectId,
        Math.max(subjectAffinities.get(subjectId) || 0, clampAffinity(affinity)),
      );
    }
  }
  for (const subjectId of preferences.subjectIds || []) {
    subjectAffinities.set(subjectId, 1);
  }

  const tagAffinities = new Map<string, number>();
  for (const [tagName, affinity] of Object.entries(
    preferences.tagAffinities || {},
  )) {
    if (affinity > 0) {
      const normalized = normalizeTag(tagName);
      tagAffinities.set(
        normalized,
        Math.max(tagAffinities.get(normalized) || 0, clampAffinity(affinity)),
      );
    }
  }
  for (const tagName of preferences.tagNames || []) {
    tagAffinities.set(normalizeTag(tagName), 1);
  }

  const hasSubjectPreferences = subjectAffinities.size > 0;
  const hasTagPreferences = tagAffinities.size > 0;
  const hasPreferences = hasSubjectPreferences || hasTagPreferences;
  const sortedTagAffinities = [...tagAffinities.values()].sort((a, b) => b - a);
  const maxViews = Math.max(...questions.map((question) => question.viewCount), 1);
  const newestCreatedAt = Math.max(
    ...questions.map((question) => new Date(question.createdAt).getTime()),
    Date.now(),
  );
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const scored = questions
    .map<ScoredQuestion>((question) => {
      const questionTags = question.tags.map(normalizeTag);
      const subjectAffinity = question.subjectId
        ? subjectAffinities.get(question.subjectId) || 0
        : 0;
      const matchedTags = questionTags.filter((tag) => tagAffinities.has(tag));
      const matchedTagAffinity = matchedTags.reduce(
        (sum, tag) => sum + (tagAffinities.get(tag) || 0),
        0,
      );
      // Best achievable affinity sum for a question with this many tag
      // slots: the user's top-N tag affinities. Matching the user's
      // strongest interests scores 1; matching weaker ones scores less.
      const bestPossibleTagAffinity = sortedTagAffinities
        .slice(0, Math.max(questionTags.length, 1))
        .reduce((sum, affinity) => sum + affinity, 0);
      const tagScore =
        hasTagPreferences && matchedTagAffinity > 0 && bestPossibleTagAffinity > 0
          ? Math.min(1, matchedTagAffinity / bestPossibleTagAffinity)
          : 0;
      const popularityScore = question.viewCount / maxViews;
      const createdAtMs = new Date(question.createdAt).getTime();
      const recentScore = Math.max(0, 1 - (newestCreatedAt - createdAtMs) / sevenDaysMs);

      const contentScore =
        subjectAffinity * SUBJECT_WEIGHT + tagScore * TAG_WEIGHT;
      const fallbackScore =
        popularityScore * POPULAR_WEIGHT + recentScore * RECENT_WEIGHT;
      const score = hasPreferences
        ? contentScore + fallbackScore
        : 0.25 + popularityScore * 0.45 + recentScore * 0.3;

      let reason: RecommendationResult["reason"] = "Recent and popular";
      if (preferences.activityBased && (subjectAffinity > 0 || matchedTags.length > 0)) {
        reason = "Based on your recent activity";
      } else if (matchedTags.length > 0) {
        reason = "Matching tags";
      } else if (subjectAffinity > 0) {
        reason = "Similar subject";
      }

      return {
        id: question.id,
        title: question.title,
        subject: question.subject,
        tags: question.tags,
        score: normalizeScore(score),
        reason,
        createdAtMs,
      };
    })
    .filter((question) => question.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.createdAtMs - a.createdAtMs;
    })
    .slice(0, limit);

  return scored.map((question) => ({
    id: question.id,
    title: question.title,
    subject: question.subject,
    tags: question.tags,
    score: question.score,
    reason: question.reason,
  }));
}
