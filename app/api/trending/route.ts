import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type QuestionTagRow = {
  tag_id: string;
};

type TagRow = {
  id: string;
  name: string;
};

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const { data: recentQuestions, error: questionsError } = await supabase
      .from("questions")
      .select("id")
      .gte("created_at", sevenDaysAgo.toISOString());

    if (questionsError) {
      return NextResponse.json(
        { error: questionsError.message },
        { status: 500 },
      );
    }

    const questionIds =
      (recentQuestions || []).map((q: { id: string }) => q.id) || [];

    if (questionIds.length === 0) {
      return NextResponse.json({
        tags: [],
      });
    }

    const { data: questionTags, error: tagsError } = await supabase
      .from("question_tags")
      .select("tag_id")
      .in("question_id", questionIds);

    if (tagsError) {
      return NextResponse.json({ error: tagsError.message }, { status: 500 });
    }

    const tagIds = [...new Set((questionTags || []).map((qt: QuestionTagRow) => qt.tag_id))];

    if (tagIds.length === 0) {
      return NextResponse.json({
        tags: [],
      });
    }

    const { data: tags, error: tagDetailsError } = await supabase
      .from("tags")
      .select("id, name")
      .in("id", tagIds);

    if (tagDetailsError) {
      return NextResponse.json(
        { error: tagDetailsError.message },
        { status: 500 },
      );
    }

    const tagsByName = new Map<string, number>();
    for (const qt of (questionTags || []) as QuestionTagRow[]) {
      const tag = (tags || []).find((t: TagRow) => t.id === qt.tag_id);
      if (tag) {
        tagsByName.set(tag.name, (tagsByName.get(tag.name) || 0) + 1);
      }
    }

    const sortedTags = Array.from(tagsByName.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return NextResponse.json({
      tags: sortedTags,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch trending tags",
      },
      { status: 500 },
    );
  }
}
