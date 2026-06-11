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

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function normalizeScore(value: number) {
  return Number(Math.min(1, Math.max(0, value)).toFixed(2));
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
  const subjectIds = new Set(preferences.subjectIds || []);
  const tagNames = new Set((preferences.tagNames || []).map(normalizeTag));
  const hasSubjectPreferences = subjectIds.size > 0;
  const hasTagPreferences = tagNames.size > 0;
  const hasPreferences = hasSubjectPreferences || hasTagPreferences;
  const maxViews = Math.max(...questions.map((question) => question.viewCount), 1);
  const newestCreatedAt = Math.max(
    ...questions.map((question) => new Date(question.createdAt).getTime()),
    Date.now(),
  );
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  const scored = questions
    .map<ScoredQuestion>((question) => {
      const questionTags = question.tags.map(normalizeTag);
      const subjectMatched =
        Boolean(question.subjectId) && subjectIds.has(question.subjectId || "");
      const matchingTagCount = questionTags.filter((tag) => tagNames.has(tag)).length;
      const tagScore =
        hasTagPreferences && matchingTagCount
          ? matchingTagCount / Math.max(tagNames.size, 1)
          : 0;
      const popularityScore = question.viewCount / maxViews;
      const createdAtMs = new Date(question.createdAt).getTime();
      const recentScore = Math.max(0, 1 - (newestCreatedAt - createdAtMs) / sevenDaysMs);

      const contentScore =
        (subjectMatched ? SUBJECT_WEIGHT : 0) + tagScore * TAG_WEIGHT;
      const fallbackScore =
        popularityScore * POPULAR_WEIGHT + recentScore * RECENT_WEIGHT;
      const score = hasPreferences
        ? contentScore + fallbackScore
        : 0.25 + popularityScore * 0.45 + recentScore * 0.3;

      let reason: RecommendationResult["reason"] = "Recent and popular";
      if (preferences.activityBased && (subjectMatched || matchingTagCount > 0)) {
        reason = "Based on your recent activity";
      } else if (matchingTagCount > 0) {
        reason = "Matching tags";
      } else if (subjectMatched) {
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
