-- seed-demo-content-extra.sql
-- ADDITIVE demo content, separate from seed-demo-content.sql. Adds questions
-- that SHOWCASE FEATURES for a live demo:
--   * multiple competing answers per question (compare-explanations)
--   * a preferred/accepted answer with votes (ranking)
--   * a Science subject (ties to the tutor's math/science/English coverage)
--   * open questions (empty state) so the feed shows every status
-- Content is grounded in the tutor's own training/eval data (GSM8K word
-- problems, ScienceQA, grammar-correction) so the demo matches the model.
-- Bodies are plain prose (the app renders answer/question text without markdown).
--
-- Run in the Supabase SQL editor (runs as postgres, bypasses RLS).
-- Idempotent: skips itself if its first question already exists.
-- Remove with scripts/cleanup-test-data.sql or by deleting the titles below.

do $$
declare
  authors uuid[];
  au0 uuid; au1 uuid; au2 uuid; au3 uuid;

  subj_math uuid; subj_english uuid; subj_cs uuid; subj_science uuid;

  tag_algebra uuid; tag_word_problems uuid; tag_grammar uuid;
  tag_algorithms uuid; tag_chemistry uuid; tag_physics uuid;

  q1 uuid; q2 uuid; q3 uuid; q4 uuid; q5 uuid; q6 uuid; q7 uuid; q8 uuid;
begin
  select array_agg(id) into authors
  from (select id from public.profiles order by created_at limit 4) p;
  if authors is null then
    raise exception 'Need at least one profile to author seed questions';
  end if;
  au0 := authors[1 + (0 % array_length(authors,1))];
  au1 := authors[1 + (1 % array_length(authors,1))];
  au2 := authors[1 + (2 % array_length(authors,1))];
  au3 := authors[1 + (3 % array_length(authors,1))];

  if exists (select 1 from public.questions
             where title = 'Natalia sold 48 clips in April and half as many in May, what is the total?') then
    raise notice 'Extra demo seed already present, skipping.';
    return;
  end if;

  -- Science subject + tags (all idempotent).
  insert into public.subjects (name, slug) values ('Science', 'science')
    on conflict (slug) do nothing;
  insert into public.tags (name, slug) values
    ('Algebra','algebra'), ('Word Problems','word-problems'),
    ('Chemistry','chemistry'), ('Physics','physics')
    on conflict (slug) do nothing;

  select id into subj_math    from public.subjects where slug = 'mathematics';
  select id into subj_english from public.subjects where slug = 'english';
  select id into subj_cs      from public.subjects where slug = 'computer-science';
  select id into subj_science from public.subjects where slug = 'science';

  select id into tag_algebra       from public.tags where slug = 'algebra';
  select id into tag_word_problems from public.tags where slug = 'word-problems';
  select id into tag_grammar       from public.tags where slug = 'grammar';
  select id into tag_algorithms    from public.tags where slug = 'algorithms';
  select id into tag_chemistry     from public.tags where slug = 'chemistry';
  select id into tag_physics       from public.tags where slug = 'physics';

  ------------------------------------------------------------------
  -- Q1 (MATH, GSM8K) — THREE competing explanations. The hero demo of
  -- "compare multiple answers": step-by-step vs conceptual vs mistake-catcher.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_math,
    'Natalia sold 48 clips in April and half as many in May, what is the total?',
    E'Natalia sold clips to 48 of her friends in April, and then she sold half as many clips in May. How many clips did she sell altogether? I keep second-guessing what "half as many" does to the number.',
    'resolved', 137, now() - interval '1 day 2 hours')
  returning id into q1;

  insert into public.answers (question_id, author_id, body, created_at)
  values (q1, au1,
    E'Step by step. April is 48 clips. "Half as many" in May means 48 divided by 2, which is 24. So the total is 48 + 24 = 72 clips.',
    now() - interval '1 day');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q1, au2,
    E'Think of it conceptually: "half as many" scales April by one half, so May is smaller than April, not equal to it. May = 48 times 1/2 = 24. Add the two months: 48 + 24 = 72.',
    now() - interval '23 hours');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q1, au3,
    E'Careful, the common trap is reading "half as many" as "48 again" and answering 96. It means HALF of April (24), not another 48. The correct total is 72, not 96.',
    now() - interval '22 hours');

  ------------------------------------------------------------------
  -- Q2 (MATH, GSM8K) — TWO valid methods reaching the same answer.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_math,
    'Weng earns $12 per hour and babysat for 50 minutes, how much did she earn?',
    E'She earns $12 an hour but only worked 50 minutes, not a full hour. How do I handle the partial hour without a calculator?',
    'answered', 64, now() - interval '20 hours')
  returning id into q2;

  insert into public.answers (question_id, author_id, body, created_at)
  values (q2, au2,
    E'Per-minute method: 12 divided by 60 is $0.20 per minute. Then 50 minutes times $0.20 = $10.',
    now() - interval '18 hours');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q2, au3,
    E'Fraction-of-an-hour method: 50 minutes is 50/60 = 5/6 of an hour. Then 5/6 times $12 = $10. Same answer, use whichever feels natural to you.',
    now() - interval '17 hours');

  ------------------------------------------------------------------
  -- Q3 (SCIENCE, ScienceQA) — concept with two answers.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au2, subj_science,
    'Is sewing an apron a physical or a chemical change?',
    E'Homework asks whether sewing an apron is a chemical change or a physical change. I picked chemical because the apron looks different afterwards, but I got it wrong. Why?',
    'answered', 78, now() - interval '2 days 4 hours')
  returning id into q3;

  insert into public.answers (question_id, author_id, body, created_at)
  values (q3, au0,
    E'It is a physical change. The fabric and thread only change shape, they are still the same materials. No new substance is formed, so it is physical, not chemical.',
    now() - interval '2 days');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q3, au1,
    E'Quick test: did you make a NEW substance? A chemical change makes a new material with new properties, like burning or rusting. Sewing just rearranges the cloth, so the answer is physical.',
    now() - interval '1 day 22 hours');

  ------------------------------------------------------------------
  -- Q4 (SCIENCE) — single clear answer.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au3, subj_science,
    'What do tearing paper and breaking glass have in common?',
    E'The options are: both are only physical changes, both are chemical changes, or both are caused by heating. I think it is the first one but I cannot explain why confidently.',
    'answered', 53, now() - interval '3 days')
  returning id into q4;
  insert into public.answers (question_id, author_id, body, created_at)
  values (q4, au2,
    E'Both are only physical changes. Tearing paper and breaking glass change the shape or size, but each piece is still the same material (paper is still paper, glass is still glass). No new substance is made, and neither is caused by heating.',
    now() - interval '2 days 20 hours');

  ------------------------------------------------------------------
  -- Q5 (ENGLISH, grammar-correction) — fix plus the rule.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_english,
    'Is "At where is the Weddell Sea located?" grammatically correct?',
    E'I wrote "At where is the Weddell Sea located?" and it was marked wrong. What is the fix, and what is the rule behind it?',
    'answered', 45, now() - interval '1 day 14 hours')
  returning id into q5;
  insert into public.answers (question_id, author_id, body, created_at)
  values (q5, au1,
    E'Drop the "At". The correct sentence is "Where is the Weddell Sea located?" The word "where" already means "at what place", so "at where" is redundant.',
    now() - interval '1 day 10 hours');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q5, au3,
    E'Rule: "where" is an adverb of place that already includes the preposition. You would not say "at where", just like you say "where are you going" and not "to where are you going". So the fix is "Where is the Weddell Sea located?"',
    now() - interval '1 day 9 hours');

  ------------------------------------------------------------------
  -- Q6 (CS) — two answers, first one becomes preferred + voted.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au1, subj_cs,
    'Why is binary search O(log n) and not O(n)?',
    E'I understand binary search checks the middle element, but I do not get why the complexity is log n. Can someone explain the halving intuitively?',
    'resolved', 88, now() - interval '2 days 8 hours')
  returning id into q6;
  insert into public.answers (question_id, author_id, body, created_at)
  values (q6, au2,
    E'Each comparison throws away half the remaining items. From n you go to n/2, then n/4, and so on down to 1. The number of halvings needed to reach 1 is log base 2 of n. That count of steps is the running time, so it is O(log n).',
    now() - interval '2 days 6 hours');
  insert into public.answers (question_id, author_id, body, created_at)
  values (q6, au3,
    E'Formally it is the recurrence T(n) = T(n/2) + O(1): one comparison, then the same problem on half the data. Unrolling that gives O(log n). O(n) would mean touching every element, which binary search never does.',
    now() - interval '2 days 5 hours');

  ------------------------------------------------------------------
  -- Q7 & Q8 (OPEN) — unanswered, so the feed shows the open state and the
  -- "be the first to answer" call to action during the demo.
  ------------------------------------------------------------------
  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au3, subj_math,
    'How do I know when a word problem needs subtraction versus division?',
    E'I can do the arithmetic but I freeze on choosing the operation from the wording. Is there a checklist for mapping phrases like "how many more", "each", and "split" to the right operation?',
    'open', 19, now() - interval '6 hours')
  returning id into q7;

  insert into public.questions (author_id, subject_id, title, body, status, view_count, created_at)
  values (au0, subj_science,
    'Easy way to remember the difference between mass and weight?',
    E'My notes say mass and weight are not the same but the definitions blur together. Is there a one-line way to keep them straight for exams?',
    'open', 14, now() - interval '9 hours')
  returning id into q8;

  ------------------------------------------------------------------
  -- Tags
  ------------------------------------------------------------------
  insert into public.question_tags (question_id, tag_id) values
    (q1, tag_algebra), (q1, tag_word_problems),
    (q2, tag_word_problems),
    (q3, tag_chemistry), (q4, tag_chemistry),
    (q5, tag_grammar),
    (q6, tag_algorithms),
    (q7, tag_word_problems),
    (q8, tag_physics)
  on conflict do nothing;

  ------------------------------------------------------------------
  -- Preferred answers + votes (triggers keep answers.score in sync).
  ------------------------------------------------------------------
  update public.questions set preferred_answer_id = (
    select id from public.answers where question_id = q1
    order by created_at limit 1) where id = q1;
  update public.questions set preferred_answer_id = (
    select id from public.answers where question_id = q6
    order by created_at limit 1) where id = q6;

  -- Upvotes on the preferred answers from distinct non-author profiles.
  insert into public.answer_votes (answer_id, voter_id, value)
  select ans.id, p.id, 1
  from public.answers ans
  join public.questions q on q.id = ans.question_id and q.preferred_answer_id = ans.id
  join public.profiles p on p.id <> ans.author_id
  where q.id in (q1, q6)
  limit 6
  on conflict do nothing;

  raise notice 'Extra demo seed: 8 questions (multi-answer + open), Science subject, votes.';
end $$;
