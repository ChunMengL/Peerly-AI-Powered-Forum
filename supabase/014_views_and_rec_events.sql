-- 014_views_and_rec_events.sql

-- Task 1: view-count increment for everyone, including anonymous readers.
-- RLS blocks anon/authenticated UPDATEs on questions, so bump the counter through a
-- SECURITY DEFINER function. Mirrors 004's hygiene: pin search_path, revoke EXECUTE
-- from PUBLIC (anon/authenticated inherit from PUBLIC), then grant to the two client
-- roles so PostgREST can call it as an RPC.
create or replace function public.increment_question_view(question_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.questions
  set view_count = view_count + 1
  where id = question_id;
$$;

revoke execute on function public.increment_question_view(uuid) from public;
grant execute on function public.increment_question_view(uuid) to anon, authenticated;

-- Task 4: recommendation_events already has an owner-scoped SELECT policy but no
-- INSERT grant or policy, so signed-in logging would fail with 42501 before RLS runs
-- (same class as 005/009/012). Grant INSERT and add the matching owner INSERT policy.
grant insert on table public.recommendation_events to authenticated;

drop policy if exists "Users can log their own recommendation events" on public.recommendation_events;
create policy "Users can log their own recommendation events"
on public.recommendation_events for insert
to authenticated
with check (auth.uid() = user_id);
