-- seed-demo-content.sql
-- Demo content for the recommendations rehearsal: 14 questions across
-- Mathematics, English, Computer Science, Business and System Design,
-- answers with votes, and a scripted interaction history for the demo
-- account so the Recommended-for-you strip ranks Math > English > CS.
--
-- Run in the Supabase SQL editor (runs as postgres, bypasses RLS).
-- Re-running is a no-op: the script skips itself if the first seeded
-- question already exists. Remove seeded rows with scripts/cleanup-test-data.sql
-- or by deleting the questions listed below (answers/votes/tags cascade).

do $$
declare
  -- >>> SET THE DEMO ACCOUNT ID HERE <<<
  demo_user_id constant uuid := '700da212-cc6d-4f2b-b350-8ddef83ad9c9';

  authors uuid[];
  subj_math uuid;
  subj_english uuid;
  subj_cs uuid;
  subj_business uuid;
  subj_sysdes uuid;

  tag_linear_algebra uuid;
  tag_proof uuid;
  tag_calculus uuid;
  tag_statistics uuid;
  tag_grammar uuid;
  tag_essay_writing uuid;
  tag_literature uuid;
  tag_python uuid;
  tag_algorithms uuid;
  tag_database uuid;
  tag_sql uuid;
  tag_accounting uuid;
  tag_marketing uuid;

  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid;
  q8 uuid; q9 uuid; q10 uuid; q11 uuid; q12 uuid; q13 uuid; q14 uuid;

  a1 uuid; a2 uuid; a3 uuid; a4 uuid; a5 uuid; a6 uuid; a7 uuid;

  -- Rotating question/answer authors, filled from `authors` below.
  au0 uuid; au1 uuid; au2 uuid; au3 uuid;
begin
  if not exists (select 1 from public.profiles where id = demo_user_id) then
    raise exception 'Demo account % not found in profiles', demo_user_id;
  end if;

  if exists (
    select 1 from public.questions
    where title = 'How do I find the determinant of a 4x4 matrix efficiently?'
  ) then
    raise notice 'Demo seed content already present, skipping.';
    return;
  end if;

  -- Question authors and voters: existing non-demo profiles.
  select array_agg(id) into authors
  from (
    select id from public.profiles
    where id <> demo_user_id
    order by created_at
    limit 4
  ) other_profiles;

  if authors is null then
    raise exception 'Need at least one non-demo profile to author seed questions';
  end if;

  au0 := authors[1 + (0 % array_length(authors, 1))];
  au1 := authors[1 + (1 % array_length(authors, 1))];
  au2 := authors[1 + (2 % array_length(authors, 1))];
  au3 := authors[1 + (3 % array_length(authors, 1))];

  -- Subjects: English is not part of the 001 seed, add it idempotently.
  insert into public.subjects (name, slug)
  values ('English', 'english')
  on conflict (slug) do nothing;

  insert into public.tags (name, slug)
  values
    ('Calculus', 'calculus'),
    ('Statistics', 'statistics'),
    ('Grammar', 'grammar'),
    ('Essay Writing', 'essay-writing'),
    ('Literature', 'literature')
  on conflict (slug) do nothing;

  select id into subj_math from public.subjects where slug = 'mathematics';
  select id into subj_english from public.subjects where slug = 'english';
  select id into subj_cs from public.subjects where slug = 'computer-science';
  select id into subj_business from public.subjects where slug = 'business';
  select id into subj_sysdes from public.subjects where slug = 'system-design';

  select id into tag_linear_algebra from public.tags where slug = 'linear-algebra';
  select id into tag_proof from public.tags where slug = 'proof';
  select id into tag_calculus from public.tags where slug = 'calculus';
  select id into tag_statistics from public.tags where slug = 'statistics';
  select id into tag_grammar from public.tags where slug = 'grammar';
  select id into tag_essay_writing from public.tags where slug = 'essay-writing';
  select id into tag_literature from public.tags where slug = 'literature';
  select id into tag_python from public.tags where slug = 'python';
  select id into tag_algorithms from public.tags where slug = 'algorithms';
  select id into tag_database from public.tags where slug = 'database';
  select id into tag_sql from public.tags where slug = 'sql';
  select id into tag_accounting from public.tags where slug = 'accounting';
  select id into tag_marketing from public.tags where slug = 'marketing';

  ------------------------------------------------------------------
  -- Questions (created_at within the last 6 days so recency > 0)
  ------------------------------------------------------------------

  -- Mathematics (5)
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_math,
    'How do I find the determinant of a 4x4 matrix efficiently?',
    E'Cofactor expansion on a 4x4 takes forever in exams. Is row reduction to upper triangular form always safe, and how do I track the sign changes from row swaps?\n\nExample I am stuck on:\n[2 1 0 3; 1 0 2 1; 3 2 1 0; 0 1 1 2]',
    'open', 84, now() - interval '1 day 3 hours')
  returning id into q1;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_math,
    'Is my proof by contradiction that sqrt(2) is irrational valid?',
    E'I assumed sqrt(2) = p/q in lowest terms, squared both sides to get p^2 = 2q^2, argued p is even, wrote p = 2k, and got q even too - contradiction.\n\nMy tutor says I need to justify "p^2 even implies p even". Is that step really not free?',
    'open', 41, now() - interval '2 days')
  returning id into q2;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au2, subj_math,
    'When should I use integration by parts instead of u-substitution?',
    E'For integrals like x*e^x or x*cos(x) I can never decide which technique to try first. Is there a reliable heuristic (LIATE?) or do I just have to attempt both?',
    'open', 66, now() - interval '1 day 10 hours')
  returning id into q3;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au3, subj_math,
    'Intuition for eigenvalues and eigenvectors beyond the formulas?',
    E'I can compute det(A - lambda*I) = 0 mechanically but I have no picture of what an eigenvector *is*. How should I think about them geometrically, and why do repeated eigenvalues cause trouble for diagonalization?',
    'open', 112, now() - interval '3 days')
  returning id into q4;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_math,
    'How do I interpret a p-value of 0.048 without overclaiming?',
    E'My stats assignment got p = 0.048 with alpha = 0.05. Can I say the alternative hypothesis is "95.2% likely to be true"? My lecturer wrote "NO" in red but did not explain what the correct reading is.',
    'open', 37, now() - interval '20 hours')
  returning id into q5;

  -- English (4)
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_english,
    'How do I write a thesis statement that is arguable, not just a topic?',
    E'My draft thesis is "Social media affects teenagers", and the feedback was "this is a topic, not an argument". What makes a thesis statement genuinely arguable, and how specific is too specific for a 1500-word essay?',
    'open', 73, now() - interval '2 days 6 hours')
  returning id into q6;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au2, subj_english,
    'Who vs whom: is there a substitution trick that always works?',
    E'I know "whom" is the object form but I still freeze mid-sentence. Someone mentioned substituting he/him to decide. Does that trick hold up in questions and relative clauses like "the student who/whom I think won"?',
    'open', 58, now() - interval '1 day 18 hours')
  returning id into q7;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au3, subj_english,
    'Where do I start when analysing symbolism in The Great Gatsby?',
    E'My essay question asks how Fitzgerald uses symbols to critique the American Dream. Beyond the green light, which symbols carry enough textual evidence to build paragraphs around, and how do I avoid just listing them?',
    'open', 49, now() - interval '4 days')
  returning id into q8;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_english,
    'How do I spot and fix comma splices in my own writing?',
    E'My essays keep coming back marked "CS" in the margins. I understand the definition (two independent clauses joined by a comma) but I cannot see them while proofreading my own sentences. Any reliable self-editing techniques?',
    'open', 31, now() - interval '3 days 8 hours')
  returning id into q9;

  -- Computer Science (2)
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_cs,
    'Why does my recursive quicksort in Python hit maximum recursion depth?',
    E'On a sorted input of ~2000 items my quicksort throws RecursionError. I am picking the first element as the pivot. Is the fix a better pivot, an iterative rewrite, or just raising the recursion limit?',
    'open', 95, now() - interval '2 days 12 hours')
  returning id into q10;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au2, subj_cs,
    'Normalizing to 3NF: when is it acceptable to denormalize again?',
    E'Our group project database is fully normalized but the report queries now join six tables. For a read-heavy dashboard, what are the accepted criteria for reintroducing redundancy, and how do we keep the duplicated columns consistent?',
    'open', 44, now() - interval '5 days')
  returning id into q11;

  -- Business (2)
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au3, subj_business,
    'Accrual vs cash basis accounting for a small student startup?',
    E'Our FYP business plan needs financial statements. Revenue is invoiced in March but paid in May: under each basis, which month recognizes it? And why do lecturers insist on accrual for such a tiny operation?',
    'open', 28, now() - interval '4 days 6 hours')
  returning id into q12;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_business,
    'How do I calculate customer acquisition cost for a marketing plan?',
    E'For our marketing module: do I divide total marketing spend by *new* customers only, or all active customers? And should salaries of the marketing team be included in the spend figure?',
    'open', 22, now() - interval '5 days 12 hours')
  returning id into q13;

  -- System Design (1)
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_sysdes,
    'Rate limiter for a public API: token bucket or sliding window?',
    E'Designing a rate limiter for our capstone API gateway. Token bucket allows bursts, sliding window log is exact but memory-heavy. For 100 req/min per key with occasional bursts, which is the pragmatic choice?',
    'open', 61, now() - interval '3 days 18 hours')
  returning id into q14;

  ------------------------------------------------------------------
  -- Tags
  ------------------------------------------------------------------
  insert into public.question_tags (question_id, tag_id) values
    (q1, tag_linear_algebra),
    (q2, tag_proof),
    (q3, tag_calculus),
    (q4, tag_linear_algebra), (q4, tag_proof),
    (q5, tag_statistics),
    (q6, tag_essay_writing),
    (q7, tag_grammar),
    (q8, tag_literature), (q8, tag_essay_writing),
    (q9, tag_grammar), (q9, tag_essay_writing),
    (q10, tag_python), (q10, tag_algorithms),
    (q11, tag_database), (q11, tag_sql),
    (q12, tag_accounting),
    (q13, tag_marketing),
    (q14, tag_algorithms);

  ------------------------------------------------------------------
  -- Answers + votes (vote triggers keep answers.score in sync)
  ------------------------------------------------------------------

  -- q1: two answers; the second (row reduction) wins and is preferred.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q1, au1,
    E'Cofactor expansion works but it is O(n!) - fine for theory, painful by hand. Expand along the row or column with the most zeros to cut the work down.',
    now() - interval '1 day')
  returning id into a1;

  insert into public.answers (question_id, author_id, body, created_at)
  values (q1, au2,
    E'Row reduce to upper triangular form and multiply the diagonal. Two bookkeeping rules: each row swap flips the sign, and if you scale a row by c you must divide the determinant by c (so prefer adding multiples of rows, which changes nothing). For your matrix this takes four eliminations and gives det = -13.',
    now() - interval '22 hours')
  returning id into a2;

  -- q3: one strong answer.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q3, au3,
    E'Heuristic: if the integrand is a product where one factor simplifies when differentiated (x, x^2, ln x) and the other is easy to integrate (e^x, cos x), use parts - LIATE orders the "differentiate me" candidates. If you can see the derivative of an inner function sitting next to it, that is u-substitution. x*e^x -> parts; x*e^(x^2) -> substitution.',
    now() - interval '1 day 2 hours')
  returning id into a3;

  -- q6: one answer.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q6, au0,
    E'A thesis is arguable when a reasonable reader could disagree. Test: write the counter-claim - if nobody would defend it, you have a topic, not a thesis. "Social media affects teenagers" fails; "Instagram''s engagement mechanics do more to shape teenage self-image than peer groups do" passes, and it is scoped tightly enough for 1500 words.',
    now() - interval '2 days')
  returning id into a4;

  -- q7: one answer.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q7, au3,
    E'The he/him trick survives relative clauses if you untangle the clause first: "the student who/whom I think won" -> "I think HE won" -> who. "The student whom I admire" -> "I admire HIM" -> whom. In questions, answer the question: "Who/whom did you call?" -> "I called HIM" -> whom.',
    now() - interval '1 day 12 hours')
  returning id into a5;

  -- q10: one answer.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q10, au2,
    E'First-element pivot on sorted input gives worst-case O(n) recursion depth, and Python caps depth around 1000. Fix the algorithm, not the limit: use a random or median-of-three pivot, and recurse only into the smaller partition while looping on the larger - depth drops to O(log n).',
    now() - interval '2 days 6 hours')
  returning id into a6;

  -- q12: one unvoted answer.
  insert into public.answers (question_id, author_id, body, created_at)
  values (q12, au0,
    E'Cash basis: revenue lands in May when the money arrives. Accrual: it lands in March when it was earned. Lecturers insist on accrual because it matches revenue to the period of the activity, which is what makes statements comparable - and it is what accounting standards require once you are past hobby scale.',
    now() - interval '4 days')
  returning id into a7;

  -- Votes from non-demo, non-author profiles. PK (answer_id, voter_id)
  -- keeps voters distinct; the refresh trigger recomputes scores.
  insert into public.answer_votes (answer_id, voter_id, value)
  select a2, id, 1 from public.profiles
  where id <> demo_user_id and id <> au2 limit 3;

  insert into public.answer_votes (answer_id, voter_id, value)
  select a1, id, 1 from public.profiles
  where id <> demo_user_id and id <> au1 limit 1;

  insert into public.answer_votes (answer_id, voter_id, value)
  select a3, id, 1 from public.profiles
  where id <> demo_user_id and id <> au3 limit 2;

  insert into public.answer_votes (answer_id, voter_id, value)
  select a4, id, 1 from public.profiles
  where id <> demo_user_id and id <> au0 limit 2;

  insert into public.answer_votes (answer_id, voter_id, value)
  select a5, id, 1 from public.profiles
  where id <> demo_user_id and id <> au3 limit 1;

  insert into public.answer_votes (answer_id, voter_id, value)
  select a6, id, 1 from public.profiles
  where id <> demo_user_id and id <> au2 limit 2;

  -- Question statuses reflecting the answers above.
  update public.questions set status = 'resolved', preferred_answer_id = a2 where id = q1;
  update public.questions set status = 'answered' where id in (q3, q6, q7, q10, q12);

  ------------------------------------------------------------------
  -- Demo account interaction history.
  --
  -- The recommendations route weights events by type
  -- (preferred_answer_selected 5, answer_saved 4, vote_cast 3,
  -- question_created 2, question_viewed/search_performed 1) with a
  -- 7-day half-life, pulling subject/tag affinity from the linked
  -- question, tag_id, and metadata. The mix below makes Math the
  -- strongest affinity, English second, CS a distant third, so the
  -- Recommended-for-you strip shows a visibly ranked, non-empty list.
  ------------------------------------------------------------------
  insert into public.user_interactions (user_id, interaction_type, question_id, answer_id, tag_id, metadata, created_at)
  values
    -- Mathematics: repeated views, a vote, a save, targeted searches (recent).
    (demo_user_id, 'question_viewed', q1, null, tag_linear_algebra,
      '{"subject": "mathematics", "tags": ["linear algebra"]}', now() - interval '26 hours'),
    (demo_user_id, 'question_viewed', q1, null, tag_linear_algebra,
      '{"subject": "mathematics", "tags": ["linear algebra"]}', now() - interval '8 hours'),
    (demo_user_id, 'vote_cast', q1, a2, tag_linear_algebra,
      '{"subject": "mathematics", "tags": ["linear algebra"], "value": 1}', now() - interval '7 hours'),
    (demo_user_id, 'answer_saved', q1, a2, tag_linear_algebra,
      '{"subject": "mathematics", "tags": ["linear algebra"]}', now() - interval '7 hours'),
    (demo_user_id, 'question_viewed', q4, null, tag_linear_algebra,
      '{"subject": "mathematics", "tags": ["linear algebra", "proof"]}', now() - interval '30 hours'),
    (demo_user_id, 'question_viewed', q3, null, tag_calculus,
      '{"subject": "mathematics", "tags": ["calculus"]}', now() - interval '12 hours'),
    (demo_user_id, 'search_performed', null, null, null,
      '{"query": "determinant row reduction", "subject": "mathematics", "tags": ["linear algebra"]}', now() - interval '27 hours'),
    (demo_user_id, 'search_performed', null, null, null,
      '{"query": "integration by parts examples", "subject": "mathematics", "tags": ["calculus"]}', now() - interval '13 hours'),

    -- English: a couple of views, one vote, one search (slightly older).
    (demo_user_id, 'question_viewed', q6, null, tag_essay_writing,
      '{"subject": "english", "tags": ["essay writing"]}', now() - interval '2 days'),
    (demo_user_id, 'vote_cast', q6, a4, tag_essay_writing,
      '{"subject": "english", "tags": ["essay writing"], "value": 1}', now() - interval '2 days'),
    (demo_user_id, 'question_viewed', q7, null, tag_grammar,
      '{"subject": "english", "tags": ["grammar"]}', now() - interval '40 hours'),
    (demo_user_id, 'search_performed', null, null, null,
      '{"query": "thesis statement examples", "subject": "english", "tags": ["essay writing"]}', now() - interval '2 days 1 hour'),

    -- Light long-tail: one CS view, one System Design view (older).
    (demo_user_id, 'question_viewed', q10, null, tag_python,
      '{"subject": "computer-science", "tags": ["python", "algorithms"]}', now() - interval '4 days'),
    (demo_user_id, 'question_viewed', q14, null, tag_algorithms,
      '{"subject": "system-design", "tags": ["algorithms"]}', now() - interval '5 days');

  -- Keep the saved-answer UI consistent with the answer_saved interaction.
  insert into public.answer_saves (answer_id, user_id)
  values (a2, demo_user_id)
  on conflict do nothing;

  -- Keep vote UI consistent with the demo user's vote_cast interactions.
  insert into public.answer_votes (answer_id, voter_id, value)
  values (a2, demo_user_id, 1), (a4, demo_user_id, 1)
  on conflict do nothing;

  raise notice 'Seeded 14 questions, 7 answers, votes, and 14 demo interactions for user %', demo_user_id;
end $$;
