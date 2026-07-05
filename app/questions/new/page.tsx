import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type NewQuestionPageProps = {
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

function buildMessageRedirect(message: string) {
  const url = new URL(
    "/questions/new",
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  );
  url.searchParams.set("status", "error");
  url.searchParams.set("message", message);
  return `${url.pathname}${url.search}`;
}

async function createQuestion(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const subjectId = String(formData.get("subjectId") || "").trim();
  const tagIds = formData
    .getAll("tagIds")
    .map((tagId) => String(tagId))
    .filter(Boolean)
    .slice(0, 5);

  if (title.length < 8 || title.length > 180) {
    redirect(
      buildMessageRedirect("Title must be between 8 and 180 characters."),
    );
  }

  if (body.length < 20) {
    redirect(
      buildMessageRedirect("Question details must be at least 20 characters."),
    );
  }

  const { data: question, error: questionError } = await supabase
    .from("questions")
    .insert({
      author_id: user.id,
      body,
      subject_id: subjectId || null,
      title,
    })
    .select("id")
    .single();

  if (questionError || !question) {
    redirect(
      buildMessageRedirect(
        questionError?.message || "Could not create the question.",
      ),
    );
  }

  if (tagIds.length) {
    const { error: tagError } = await supabase.from("question_tags").insert(
      tagIds.map((tagId) => ({
        question_id: question.id,
        tag_id: tagId,
      })),
    );

    if (tagError) {
      redirect(buildMessageRedirect(tagError.message));
    }
  }

  revalidatePath("/");
  revalidatePath("/profile");
  redirect(`/questions/${question.id}`);
}

export default async function NewQuestionPage({
  searchParams,
}: NewQuestionPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?status=info&message=Please%20sign%20in%20first.");
  }

  const [subjectsResult, tagsResult] = await Promise.all([
    supabase.from("subjects").select("id, name").order("name"),
    supabase.from("tags").select("id, name").order("name"),
  ]);
  const subjects = subjectsResult.data || [];
  const tags = tagsResult.data || [];
  const optionError = subjectsResult.error || tagsResult.error;
  const params = await searchParams;

  return (
    <main className="question-page">
      <section className="question-shell">
        <div className="profile-hero-head">
          <Link className="profile-back" href="/">
            Back to feed
          </Link>
          <Link className="profile-back" href="/profile">
            Profile
          </Link>
        </div>

        <section className="question-detail question-compose">
          <div className="question-detail-head">
            <div>
              <span className="eyebrow">Ask Peerly</span>
              <h1>Create a question</h1>
              <p>
                Add enough context for classmates, recommendations, and the
                future chatbot to understand the problem.
              </p>
            </div>
            <span className="pill">Forum flow</span>
          </div>

          <form action={createQuestion} className="question-form">
            {optionError ? (
              <p className="auth-status" data-state="error">
                Could not load subjects and tags: {optionError.message}. Run
                supabase/003_forum_permissions_and_seed.sql in the Supabase SQL
                editor.
              </p>
            ) : null}

            <div className="field">
              <label htmlFor="title">Question title</label>
              <input
                id="title"
                maxLength={180}
                minLength={8}
                name="title"
                placeholder="What are you trying to understand?"
                required
                type="text"
              />
            </div>

            <div className="field">
              <label htmlFor="subjectId">Subject</label>
              <select id="subjectId" name="subjectId">
                <option value="">General / Other</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
              {!subjects.length && !optionError ? (
                <span className="field-note">
                  No subjects have been added to Supabase yet. This question
                  will be posted under General.
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="body">Question details</label>
              <textarea
                id="body"
                minLength={20}
                name="body"
                placeholder="Explain what you tried, where you got stuck, and what kind of answer would help."
                required
                rows={8}
              />
            </div>

            <fieldset className="tag-picker">
              <legend>Tags</legend>
              {tags.length ? (
                <div className="tag-options">
                  {tags.map((tag) => (
                    <label key={tag.id}>
                      <input name="tagIds" type="checkbox" value={tag.id} />
                      <span>{tag.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="field-note">
                  No tags are available yet. You can post without tags.
                </p>
              )}
            </fieldset>

            <div className="profile-actions question-form-actions">
              <button className="btn primary" type="submit">
                Post question
              </button>
              <Link href="/">Cancel</Link>
            </div>
          </form>

          {params.message ? (
            <p className="auth-status" data-state={params.status || "info"}>
              {params.message}
            </p>
          ) : null}
        </section>
      </section>
    </main>
  );
}
