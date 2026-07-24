-- 015_dedup_question_views.sql

-- Deduplicate view counting per signed-in reader. Before this, every page load
-- bumped view_count, so a refresh inflated it. The function keeps its 014
-- hygiene (SECURITY DEFINER with a pinned search_path, EXECUTE revoked from
-- PUBLIC then granted to the two client roles) because RLS blocks the UPDATE for
-- anon/authenticated and PostgREST must still reach it as an RPC.
--
-- Drop the 1-arg signature first: adding a defaulted second parameter would
-- otherwise leave two overloads and make the RPC call ambiguous.
drop function if exists public.increment_question_view(uuid);

create or replace function public.increment_question_view(
  question_id uuid,
  viewer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_view boolean := true;
begin
  -- Signed-in readers count once per question; the existing question_viewed
  -- interaction row is the dedup marker, so no new table or column is needed.
  -- Authors never bump their own posts. Anonymous readers have no identity, so
  -- they still count per load -- a documented limitation, which is part of why
  -- view_count is displayed but never ranked on.
  if viewer_id is not null then
    select
      not exists (
        select 1
        from public.user_interactions ui
        where ui.user_id = viewer_id
          and ui.question_id = increment_question_view.question_id
          and ui.interaction_type = 'question_viewed'
      )
      and not exists (
        select 1
        from public.questions q
        where q.id = increment_question_view.question_id
          and q.author_id = viewer_id
      )
    into first_view;
  end if;

  if first_view then
    update public.questions
    set view_count = view_count + 1
    where id = increment_question_view.question_id;
  end if;
end;
$$;

revoke execute on function public.increment_question_view(uuid, uuid) from public;
grant execute on function public.increment_question_view(uuid, uuid)
  to anon, authenticated;
