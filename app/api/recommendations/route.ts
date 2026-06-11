import { NextRequest, NextResponse } from "next/server";
import {
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
};

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

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const search = request.nextUrl.searchParams;
  const limit = clampLimit(search.get("limit"));
  const seedQuestionId = search.get("questionId") || search.get("question_id");
  const explicitTags = parseCsv(search.get("tags"));
  const explicitSubject = search.get("subject");

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
  const subjectIds = new Set<string>();
  const tagNames = new Set<string>(explicitTags);

  if (subjectPreference) {
    subjectIds.add(subjectPreference.id);
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;
  const activityQuestionIds = new Set<string>();
  const activityTagIds = new Set<string>();

  if (seedQuestionId) {
    activityQuestionIds.add(seedQuestionId);
  }

  if (userId) {
    const { data: interactions, error: interactionsError } = await supabase
      .from("user_interactions")
      .select("interaction_type, question_id, tag_id, metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(25);

    if (interactionsError) {
      return NextResponse.json(
        { error: interactionsError.message },
        { status: 500 },
      );
    }

    for (const interaction of (interactions || []) as InteractionRow[]) {
      if (interaction.question_id) {
        activityQuestionIds.add(interaction.question_id);
      }
      if (interaction.tag_id) {
        activityTagIds.add(interaction.tag_id);
      }

      const metadataSubject = findSubject(
        subjectRows,
        getMetadataString(interaction.metadata, "subject"),
      );
      if (metadataSubject) {
        subjectIds.add(metadataSubject.id);
      }

      for (const tag of getMetadataStringArray(interaction.metadata, "tags")) {
        tagNames.add(tag);
      }

      const metadataTag = getMetadataString(interaction.metadata, "tag");
      if (metadataTag) {
        tagNames.add(metadataTag);
      }
    }
  }

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
      if (question.subject_id) {
        subjectIds.add(question.subject_id);
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
      ...activityTagIds,
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

    if (activityQuestionIds.has(questionTag.question_id)) {
      tagNames.add(tag.name);
    }
  }

  for (const tagId of activityTagIds) {
    const tag = tagsById.get(tagId);
    if (tag) {
      tagNames.add(tag.name);
    }
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
      subjectIds: [...subjectIds],
      tagNames: [...tagNames],
      activityBased:
        userId !== null &&
        !explicitSubject &&
        !explicitTags.length &&
        (activityQuestionIds.size > 0 || activityTagIds.size > 0),
    },
    limit,
  });

  return NextResponse.json({
    recommendations,
    source: "database",
    algorithmVersion: "subject-tag-v1",
  });
}
