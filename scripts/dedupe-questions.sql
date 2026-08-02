-- dedupe-questions.sql
-- Collapses duplicate rows in public.questions down to a single canonical row.
--
-- BACKGROUND
--   On 2026-07-30 the "Create a question" form posted the same question 23 times
--   in about two minutes (05:20:58 - 05:22:47 UTC). At the time the submit
--   button gave no feedback while the server action was in flight, so a slow
--   post looked like a frozen page and invited repeated clicks. Commit 9d36213
--   ("show progress while server actions and navigation are in flight", 08:09
--   UTC the same day) disabled the button while pending, which closed the hole
--   roughly three hours after the burst. No duplicates have been created since.
--   This script cleans up the rows that were already there.
--
-- HOW TO USE
--   1. Run STEP 1 on its own and review the groups it reports.
--   2. Run STEP 2 to see which row would survive each group and what it holds.
--   3. Only if both previews look right, run STEP 3 manually.
--
-- WHAT IT DOES
--   Groups questions by normalised (title, body). Within each group it keeps the
--   row with the most engagement -- views first, then answers, then interactions,
--   then oldest as the tiebreak -- and deletes the rest. Answers on the losing
--   rows are re-pointed onto the keeper first, so no reply is ever lost to a
--   cascade. Deleting a question cascades to question_tags, user_interactions,
--   recommendation_events, and attachments; ai_conversations.question_id is
--   ON DELETE SET NULL, so tutor history survives.
--
--   Questions that merely share a title are NOT touched -- "Data Mining /
--   What is sensitivity?" and "Data Mining / If i have imbalanced target
--   distribution..." are different questions and both survive.

-- ============================================================================
-- Shared ranking: one row per question, numbered within its duplicate group.
-- rn = 1 is the keeper.
-- ============================================================================
create or replace view public.question_dupe_ranking as
select
  q.id,
  q.title,
  q.body,
  lower(trim(q.title)) as norm_title,
  lower(trim(coalesce(q.body, ''))) as norm_body,
  count(*) over w as group_size,
  first_value(q.id) over (
    partition by lower(trim(q.title)), lower(trim(coalesce(q.body, '')))
    order by
      q.view_count desc,
      (select count(*) from public.answers a where a.question_id = q.id) desc,
      (select count(*) from public.user_interactions i where i.question_id = q.id) desc,
      q.created_at asc
  ) as keeper_id,
  row_number() over (
    partition by lower(trim(q.title)), lower(trim(coalesce(q.body, '')))
    order by
      q.view_count desc,
      (select count(*) from public.answers a where a.question_id = q.id) desc,
      (select count(*) from public.user_interactions i where i.question_id = q.id) desc,
      q.created_at asc
  ) as rn
from public.questions q
window w as (
  partition by lower(trim(q.title)), lower(trim(coalesce(q.body, '')))
);

-- ============================================================================
-- STEP 1 - VERIFICATION: which groups have duplicates? Read-only.
-- ============================================================================
select
  norm_title,
  left(norm_body, 60) as norm_body,
  group_size,
  count(*) filter (where rn > 1) as would_delete
from public.question_dupe_ranking
where group_size > 1
group by norm_title, norm_body, group_size
order by group_size desc;

-- ============================================================================
-- STEP 2 - VERIFICATION: what survives, and what gets removed? Read-only.
-- ============================================================================
select
  case when r.rn = 1 then 'KEEP' else 'DELETE' end as action,
  r.id,
  r.title,
  left(coalesce(r.body, ''), 50) as body,
  q.view_count,
  (select count(*) from public.answers a where a.question_id = r.id) as answers,
  (select count(*) from public.question_tags t where t.question_id = r.id) as tags
from public.question_dupe_ranking r
join public.questions q on q.id = r.id
where r.group_size > 1
order by r.norm_title, r.norm_body, r.rn;

-- ============================================================================
-- STEP 3 - DESTRUCTIVE: run only after reviewing steps 1 and 2.
-- ============================================================================
begin;

-- Move answers off the losing rows so no reply is lost to the cascade.
update public.answers a
   set question_id = r.keeper_id
  from public.question_dupe_ranking r
 where a.question_id = r.id
   and r.rn > 1;

-- Drop the duplicates.
delete from public.questions q
 using public.question_dupe_ranking r
 where q.id = r.id
   and r.rn > 1;

commit;

-- Expect 0 rows after a successful run.
select norm_title, group_size
from public.question_dupe_ranking
where group_size > 1;

drop view if exists public.question_dupe_ranking;
