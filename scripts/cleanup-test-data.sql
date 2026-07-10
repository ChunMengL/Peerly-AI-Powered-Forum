-- cleanup-test-data.sql
-- Removes QA test-account artifacts from the database before the demo.
--
-- HOW TO USE
--   1. Edit the email list in the test_users CTE below if the QA accounts change.
--   2. Run STEP 1 (verification SELECT) on its own and review what would be deleted.
--   3. If the preview looks right, run STEP 2 (the transaction) manually.
--
-- WHAT IT DELETES
--   For every auth user whose email is in the list:
--     - answers they authored (answers.author_id is ON DELETE SET NULL, so these
--       must be removed explicitly or they would be orphaned as anonymous answers)
--     - questions they authored, plus any question titled with the [TEST] prefix
--       (question deletes cascade to question_tags, answers, attachments, etc.)
--     - their profiles row, which cascades to user_interactions,
--       recommendation_events, answer_votes/comments/feedback/saves,
--       ai_conversations (and ai_messages), lecturer_verification_requests,
--       and attachments they own
--   The auth.users rows themselves are NOT deleted, so the accounts can still
--   sign in afterwards (a fresh profiles row must be recreated if needed).

-- ============================================================================
-- STEP 1 — VERIFICATION: run this first; it only reads.
-- ============================================================================
with test_users as (
  select u.id, u.email
  from auth.users u
  where u.email in (
    -- QA test account emails (edit here):
    'peerly.test.student@gmail.com',
    'peerly.test.lecturer@gmail.com'
  )
)
select 'profiles' as artifact, p.id::text as id, p.display_name as detail
from public.profiles p
join test_users t on t.id = p.id
union all
select 'questions (authored)', q.id::text, q.title
from public.questions q
join test_users t on t.id = q.author_id
union all
select 'questions ([TEST] titled)', q.id::text, q.title
from public.questions q
where q.title like '[TEST]%'
  and q.author_id not in (select id from test_users)
union all
select 'answers (authored)', a.id::text, left(a.body, 80)
from public.answers a
join test_users t on t.id = a.author_id
union all
select 'user_interactions', count(*)::text, 'rows'
from public.user_interactions i
join test_users t on t.id = i.user_id
union all
select 'recommendation_events', count(*)::text, 'rows'
from public.recommendation_events r
join test_users t on t.id = r.user_id
union all
select 'ai_conversations', count(*)::text, 'rows (messages cascade)'
from public.ai_conversations c
join test_users t on t.id = c.user_id
union all
select 'answer_saves', count(*)::text, 'rows'
from public.answer_saves s
join test_users t on t.id = s.user_id
union all
select 'answer_votes', count(*)::text, 'rows'
from public.answer_votes v
join test_users t on t.id = v.voter_id
union all
select 'lecturer_verification_requests', count(*)::text, 'rows'
from public.lecturer_verification_requests l
join test_users t on t.id = l.user_id
order by artifact;

-- ============================================================================
-- STEP 2 — DELETION: run manually only after reviewing STEP 1 output.
-- ============================================================================
begin;

create temp table _test_users on commit drop as
select u.id
from auth.users u
where u.email in (
  -- QA test account emails (keep in sync with STEP 1):
  'peerly.test.student@gmail.com',
  'peerly.test.lecturer@gmail.com'
);

-- Answers authored by test users (author_id is ON DELETE SET NULL, so these
-- would otherwise survive the profile delete as anonymous answers).
delete from public.answers a
using _test_users t
where a.author_id = t.id;

-- Seeded [TEST] threads regardless of author, plus any questions the test
-- users created. Cascades to question_tags, remaining answers, attachments.
delete from public.questions q
where q.title like '[TEST]%'
   or q.author_id in (select id from _test_users);

-- Profiles rows: cascades to user_interactions, recommendation_events,
-- answer_votes/comments/feedback/saves, ai_conversations + ai_messages,
-- lecturer_verification_requests, and owned attachments. Preferences and
-- skill_level live on this row, so seeded prefs go with it.
delete from public.profiles p
using _test_users t
where p.id = t.id;

commit;
