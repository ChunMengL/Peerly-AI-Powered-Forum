import { NextRequest, NextResponse } from "next/server";
import {
  INTERACTION_HALF_LIFE_DAYS,
  INTERACTION_WEIGHTS,
  scoreRecommendations,
  type RecommendationQuestion,
} from "@/lib/recommendations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

type QuestionRow = {
  id: string;
  subject_id: string | null;
  title: string;
  view_count: number;
  created_at: string;
};

type SubjectRow = {
  id: string;
  name: string;
  slug: string;
};

type QuestionTagRow = {
  question_id: string;
  tag_id: string;
};

type TagRow = {
  id: string;
  name: string;
  slug: string;
};

type InteractionRow = {
  interaction_type: string;
  question_id: string | null;
  tag_id: string | null;
  metadata: Json;
  created_at: string;
};

const INTERACTION_LOOKBACK = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const ALGORITHM_VERSION = "behavioral-affinity-v2";

function clampLimit(value: string | null) {
  const parsed = Number(value || 10);
  if (!Number.isFinite(parsed)) {
    return 10;
  }
  return Math.min(30, Math.max(1, Math.floor(parsed)));
}

function parseCsv(value: string | null) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMetadataString(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  return typeof value === "string" ? value : null;
}

function getMetadataStringArray(metadata: Json, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }

  const value = metadata[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function findSubject(subjects: SubjectRow[], value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return (
    subjects.find(
      (subject) =>
        subject.id === value ||
        subject.name.toLowerCase() === normalized ||
        subject.slug.toLowerCase() === normalized,
    ) || null
  );
}

function normalizeTag(value: string) {
  return value.trim().toLowerCase();
}

function addWeight(weights: Map<string, number>, key: string, weight: number) {
  weights.set(key, (weights.get(key) || 0) + weight);
}

function interactionWeight(interaction: InteractionRow, nowMs: number) {
  const typeWeight = INTERACTION_WEIGHTS[interaction.interaction_type] || 1;
  const ageDays = Math.max(
    0,
    (nowMs - new Date(interaction.created_at).getTime()) / DAY_MS,
  );
  return typeWeight * Math.pow(0.5, ageDays / INTERACTION_HALF_LIFE_DAYS);
}

function normalizeWeights(weights: Map<string, number>) {
  const affinities: Record<string, number> = {};
  const max = Math.max(0, ...weights.values());
  if (max <= 0) {
    return affinities;
  }

  for (const [key, weight] of weights) {
    affinities[key] = weight / max;
  }
  return affinities;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const search = request.nextUrl.searchParams;
  const limit = clampLimit(search.get("limit"));
  const seedQuestionId = search.get("questionId") || search.get("question_id");
  const explicitTags = parseCsv(search.get("tags"));
  const explicitSubject = search.get("subject");
  const nowMs = Date.now();

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name, slug")
    .order("name");

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const subjectRows = (subjects || []) as SubjectRow[];
  const subjectById = new Map(subjectRows.map((subject) => [subject.id, subject]));
  const subjectPreference = findSubject(subjectRows, explicitSubject);

  // Behavioral interest profile: interaction weights accumulate here and are
  // normalized to (0, 1] affinities. Explicit signals (query params, seed
  // question) bypass the profile and are pinned at affinity 1 afterwards.
  const subjectWeights = new Map<string, number>();
  const tagWeights = new Map<string, number>();
  const questionWeights = new Map<string, number>();
  const tagIdWeights = new Map<string, number>();
  const explicitSubjectIds = new Set<string>();
  const explicitTagNames = new Set<string>(explicitTags);
  const seedQuestionIds = new Set<string>();

  if (subjectPreference) {
    explicitSubjectIds.add(subjectPreference.id);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  if (seedQuestionId) {
    seedQuestionIds.add(seedQuestionId);
  }

  if (userId) {
    const { data: interactions, error: interactionsError } = await supabase
      .from("user_interactions")
      .select("interaction_type, question_id, tag_id, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(INTERACTION_LOOKBACK);

    if (interactionsError) {
      return NextResponse.json(
        { error: interactionsError.message },
        { status: 500 },
      );
    }

    for (const interaction of (interactions || []) as InteractionRow[]) {
      const weight = interactionWeight(interaction, nowMs);

      if (interaction.question_id) {
        addWeight(questionWeights, interaction.question_id, weight);
      }
      if (interaction.tag_id) {
        addWeight(tagIdWeights, interaction.tag_id, weight);
      }

      const metadataSubject = findSubject(
        subjectRows,
        getMetadataString(interaction.metadata, "subject"),
      );
      if (metadataSubject) {
        addWeight(subjectWeights, metadataSubject.id, weight);
      }

      for (const tag of getMetadataStringArray(interaction.metadata, "tags")) {
        addWeight(tagWeights, normalizeTag(tag), weight);
      }

      const metadataTag = getMetadataString(interaction.metadata, "tag");
      if (metadataTag) {
        addWeight(tagWeights, normalizeTag(metadataTag), weight);
      }
    }
  }

  const activityQuestionIds = new Set([
    ...questionWeights.keys(),
    ...seedQuestionIds,
  ]);

  if (activityQuestionIds.size) {
    const { data: activityQuestions, error: activityQuestionsError } =
      await supabase
        .from("questions")
        .select("id, subject_id")
        .in("id", [...activityQuestionIds]);

    if (activityQuestionsError) {
      return NextResponse.json(
        { error: activityQuestionsError.message },
        { status: 500 },
      );
    }

    for (const question of (activityQuestions || []) as Pick<
      QuestionRow,
      "id" | "subject_id"
    >[]) {
      if (!question.subject_id) {
        continue;
      }

      const weight = questionWeights.get(question.id);
      if (weight) {
        addWeight(subjectWeights, question.subject_id, weight);
      }
      if (seedQuestionIds.has(question.id)) {
        explicitSubjectIds.add(question.subject_id);
      }
    }
  }

  const candidateLimit = Math.max(80, limit * 4);
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, subject_id, title, view_count, created_at")
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(candidateLimit);

  if (questionsError) {
    return NextResponse.json({ error: questionsError.message }, { status: 500 });
  }

  const questionRows = ((questions || []) as QuestionRow[]).filter(
    (question) => question.id !== seedQuestionId,
  );
  const questionIds = [
    ...new Set([...questionRows.map((question) => question.id), ...activityQuestionIds]),
  ];

  const { data: questionTags, error: questionTagsError } = questionIds.length
    ? await supabase
        .from("question_tags")
        .select("question_id, tag_id")
        .in("question_id", questionIds)
    : { data: [], error: null };

  if (questionTagsError) {
    return NextResponse.json(
      { error: questionTagsError.message },
      { status: 500 },
    );
  }

  const questionTagRows = (questionTags || []) as QuestionTagRow[];
  const tagIds = [
    ...new Set([
      ...questionTagRows.map((questionTag) => questionTag.tag_id),
      ...tagIdWeights.keys(),
    ]),
  ];

  const { data: tags, error: tagsError } = tagIds.length
    ? await supabase.from("tags").select("id, name, slug").in("id", tagIds)
    : { data: [], error: null };

  if (tagsError) {
    return NextResponse.json({ error: tagsError.message }, { status: 500 });
  }

  const tagsById = new Map(((tags || []) as TagRow[]).map((tag) => [tag.id, tag]));
  const tagsByQuestion = new Map<string, string[]>();

  for (const questionTag of questionTagRows) {
    const tag = tagsById.get(questionTag.tag_id);
    if (!tag) {
      continue;
    }

    const existing = tagsByQuestion.get(questionTag.question_id) || [];
    existing.push(tag.name);
    tagsByQuestion.set(questionTag.question_id, existing);

    const questionWeight = questionWeights.get(questionTag.question_id);
    if (questionWeight) {
      addWeight(tagWeights, normalizeTag(tag.name), questionWeight);
    }
    if (seedQuestionIds.has(questionTag.question_id)) {
      explicitTagNames.add(tag.name);
    }
  }

  for (const [tagId, weight] of tagIdWeights) {
    const tag = tagsById.get(tagId);
    if (tag) {
      addWeight(tagWeights, normalizeTag(tag.name), weight);
    }
  }

  const hasBehavioralSignal = subjectWeights.size > 0 || tagWeights.size > 0;
  const subjectAffinities = normalizeWeights(subjectWeights);
  for (const subjectId of explicitSubjectIds) {
    subjectAffinities[subjectId] = 1;
  }

  const tagAffinities = normalizeWeights(tagWeights);
  for (const tagName of explicitTagNames) {
    tagAffinities[normalizeTag(tagName)] = 1;
  }

  const recommendationQuestions: RecommendationQuestion[] = questionRows.map(
    (question) => ({
      id: question.id,
      title: question.title,
      subjectId: question.subject_id,
      subject: question.subject_id
        ? subjectById.get(question.subject_id)?.name || "General"
        : "General",
      tags: tagsByQuestion.get(question.id) || [],
      viewCount: question.view_count,
      createdAt: question.created_at,
    }),
  );

  const recommendations = scoreRecommendations({
    questions: recommendationQuestions,
    preferences: {
      subjectAffinities,
      tagAffinities,
      activityBased:
        userId !== null &&
        !explicitSubject &&
        !explicitTags.length &&
        (hasBehavioralSignal || seedQuestionIds.size > 0),
    },
    limit,
  });

  if (userId && recommendations.length) {
    // Best-effort telemetry: one row per served recommendation, owner-scoped so
    // the INSERT policy (auth.uid() = user_id) accepts it. A logging failure must
    // never break the recommendations response.
    const { error: logError } = await supabase
      .from("recommendation_events")
      .insert(
        recommendations.map((recommendation, index) => ({
          user_id: userId,
          question_id: recommendation.id,
          algorithm_version: ALGORITHM_VERSION,
          rank_position: index + 1,
          score: recommendation.score,
        })),
      );

    if (logError) {
      console.error("Failed to log recommendation events:", logError.message);
    }
  }

  return NextResponse.json({
    recommendations,
    source: "database",
    algorithmVersion: ALGORITHM_VERSION,
  });
}
