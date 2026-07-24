import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BadgeTone, Question } from "@/lib/questions";

type QuestionRow = {
  id: string;
  author_id: string;
  subject_id: string | null;
  title: string;
  body: string;
  status: string;
  view_count: number;
  created_at: string;
};

type SubjectRow = {
  id: string;
  name: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type AnswerRow = {
  id: string;
  question_id: string;
  score: number;
};

type QuestionTagRow = {
  question_id: string;
  tag_id: string;
};

type TagRow = {
  id: string;
  name: string;
};

function formatRelativeTime(value: string) {
  const createdAt = new Date(value).getTime();
  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function createBadges(question: QuestionRow, answerCount: number) {
  const badges: Array<[string, BadgeTone]> = [];

  if (question.status === "resolved" || question.status === "answered") {
    badges.push(["Answered", "success"]);
  }

  if (answerCount > 0) {
    badges.push(["Community active", "success"]);
  }

  if (!badges.length) {
    badges.push(["Open question", "neutral"]);
  }

  return badges;
}

export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const search = request.nextUrl.searchParams;
  const query = search.get("q")?.trim() || "";
  const selectedSubject = search.get("subject") || "All";
  const sort = search.get("sort") === "trending" ? "trending" : "recent";
  const mineOnly = search.get("mine") === "1";

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  if (subjectsError) {
    return NextResponse.json({ error: subjectsError.message }, { status: 500 });
  }

  const subjectRows = (subjects || []) as SubjectRow[];
  const subjectById = new Map(subjectRows.map((item) => [item.id, item]));
  const subjectFilter =
    selectedSubject === "All"
      ? null
      : subjectRows.find((item) => item.name === selectedSubject);

  // Per-subject totals are counted over EVERY question, never the filtered
  // query, so the sidebar numbers stay put while the user filters or searches.
  // ponytail: tallied in JS over one id-only scan; move to an RPC group-by if
  // the questions table ever outgrows a single fetch.
  const { data: subjectCountRows } = await supabase
    .from("questions")
    .select("subject_id");

  const countBySubjectId = new Map<string, number>();
  for (const row of subjectCountRows || []) {
    if (!row.subject_id) {
      continue;
    }
    countBySubjectId.set(
      row.subject_id,
      (countBySubjectId.get(row.subject_id) || 0) + 1,
    );
  }

  const subjectCounts = [
    { name: "All", count: (subjectCountRows || []).length },
    ...subjectRows.map((item) => ({
      name: item.name,
      count: countBySubjectId.get(item.id) || 0,
    })),
  ];

  if (selectedSubject !== "All" && !subjectFilter) {
    return NextResponse.json({
      questions: [],
      subjects: subjectCounts,
      source: "database",
    });
  }

  // ponytail: the trending candidate set is capped, so a 48h window busier than
  // this cap would score only the newest 50. Move scoring into SQL if that lands.
  let questionQuery = supabase
    .from("questions")
    .select(
      "id, author_id, subject_id, title, body, status, view_count, created_at",
    )
    .limit(sort === "trending" ? 50 : 30);

  if (subjectFilter) {
    questionQuery = questionQuery.eq("subject_id", subjectFilter.id);
  }

  // Signed-in readers get someone else's questions by default; their own posts
  // are reachable through the sidebar "My posts" filter instead.
  if (user) {
    questionQuery = mineOnly
      ? questionQuery.eq("author_id", user.id)
      : questionQuery.neq("author_id", user.id);
  } else if (mineOnly) {
    return NextResponse.json({
      questions: [],
      subjects: subjectCounts,
      source: "database",
    });
  }

  if (query) {
    // Strip every character that is significant in the PostgREST filter grammar
    // ( , ( ) . : * " \ % _ ) so the term cannot break out of the ilike pattern
    // or manipulate the .or() clause. Collapse resulting whitespace.
    const safeQuery = query
      .replace(/[,()."'*:\\%_]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (safeQuery) {
      questionQuery = questionQuery.or(
        `title.ilike.%${safeQuery}%,body.ilike.%${safeQuery}%`,
      );
    }
  }

  // Trending means recent engagement, not views: restrict to a 48h window and
  // re-rank by the engagement score below. Nothing in the window => empty feed.
  // Candidates are taken newest-first because views no longer influence rank, so
  // ordering the candidate set by view_count would bias it on an unused signal.
  const trendingWindowStart = new Date(
    Date.now() - 48 * 60 * 60 * 1000,
  ).toISOString();

  questionQuery =
    sort === "trending"
      ? questionQuery
          .gte("created_at", trendingWindowStart)
          .order("created_at", { ascending: false })
      : questionQuery.order("created_at", { ascending: false });

  const { data: questions, error: questionsError } = await questionQuery;

  if (questionsError) {
    return NextResponse.json(
      { error: questionsError.message },
      { status: 500 },
    );
  }

  const questionRows = (questions || []) as QuestionRow[];
  const questionIds = questionRows.map((item) => item.id);
  const authorIds = [...new Set(questionRows.map((item) => item.author_id))];

  const [profilesResult, answersResult, questionTagsResult] = await Promise.all(
    [
      authorIds.length
        ? supabase
            .from("profiles")
            .select("id, display_name")
            .in("id", authorIds)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length
        ? supabase
            .from("answers")
            .select("id, question_id, score")
            .in("question_id", questionIds)
        : Promise.resolve({ data: [], error: null }),
      questionIds.length
        ? supabase
            .from("question_tags")
            .select("question_id, tag_id")
            .in("question_id", questionIds)
        : Promise.resolve({ data: [], error: null }),
    ],
  );

  if (profilesResult.error || answersResult.error || questionTagsResult.error) {
    return NextResponse.json(
      {
        error:
          profilesResult.error?.message ||
          answersResult.error?.message ||
          questionTagsResult.error?.message,
      },
      { status: 500 },
    );
  }

  const questionTagRows = (questionTagsResult.data || []) as QuestionTagRow[];
  const tagIds = [...new Set(questionTagRows.map((item) => item.tag_id))];
  const tagsResult = tagIds.length
    ? await supabase.from("tags").select("id, name").in("id", tagIds)
    : { data: [], error: null };

  if (tagsResult.error) {
    return NextResponse.json(
      { error: tagsResult.error.message },
      { status: 500 },
    );
  }

  const answerRows = (answersResult.data || []) as AnswerRow[];

  // Comment volume only feeds the trending score, so skip the round trip on the
  // recent feed.
  const commentsByQuestion = new Map<string, number>();
  if (sort === "trending" && answerRows.length) {
    const questionByAnswerId = new Map(
      answerRows.map((answer) => [answer.id, answer.question_id]),
    );
    const { data: commentRows } = await supabase
      .from("answer_comments")
      .select("answer_id")
      .in(
        "answer_id",
        answerRows.map((answer) => answer.id),
      );

    for (const comment of commentRows || []) {
      const questionId = questionByAnswerId.get(comment.answer_id);
      if (questionId) {
        commentsByQuestion.set(
          questionId,
          (commentsByQuestion.get(questionId) || 0) + 1,
        );
      }
    }
  }

  const profilesById = new Map(
    ((profilesResult.data || []) as ProfileRow[]).map((item) => [
      item.id,
      item,
    ]),
  );
  const tagsById = new Map(
    ((tagsResult.data || []) as TagRow[]).map((item) => [item.id, item]),
  );
  const answersByQuestion = new Map<string, AnswerRow[]>();
  const tagsByQuestion = new Map<string, string[]>();

  for (const answer of answerRows) {
    const existing = answersByQuestion.get(answer.question_id) || [];
    existing.push(answer);
    answersByQuestion.set(answer.question_id, existing);
  }

  for (const questionTag of questionTagRows) {
    const tag = tagsById.get(questionTag.tag_id);
    if (!tag) {
      continue;
    }
    const existing = tagsByQuestion.get(questionTag.question_id) || [];
    existing.push(tag.name);
    tagsByQuestion.set(questionTag.question_id, existing);
  }

  const responseQuestions: Question[] = questionRows.map((question, index) => {
    const answers = answersByQuestion.get(question.id) || [];
    const subject = question.subject_id
      ? subjectById.get(question.subject_id)?.name || "General"
      : "General";
    const score = answers.reduce((total, answer) => total + answer.score, 0);
    // Engagement only: views are deliberately excluded. They are noisy,
    // bot-inflatable, and bumped here by a publicly-callable RPC, so they stay a
    // displayed number and never a ranking input.
    // ponytail: flat weights — a vote counts for three, a comment two. Tunable.
    const traction = score * 3 + (commentsByQuestion.get(question.id) || 0) * 2;

    return {
      id: question.id,
      title: question.title,
      preview:
        question.body.length > 220
          ? `${question.body.slice(0, 217)}...`
          : question.body,
      author:
        profilesById.get(question.author_id)?.display_name || "Peerly member",
      subject,
      tags: tagsByQuestion.get(question.id) || [],
      answers: answers.length,
      votes: score,
      views: question.view_count,
      time: formatRelativeTime(question.created_at),
      recent: index + 1,
      trending: traction,
      badges: createBadges(question, answers.length),
    };
  });

  if (sort === "trending") {
    responseQuestions.sort((a, b) => b.trending - a.trending);
  }

  return NextResponse.json({
    questions: responseQuestions,
    subjects: subjectCounts,
    source: "database",
  });
}
