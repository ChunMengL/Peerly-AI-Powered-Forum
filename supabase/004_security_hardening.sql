-- 004_security_hardening.sql

-- (a) Pin search_path on the trigger helper
alter function public.set_updated_at() set search_path = public;

-- (b) Trigger/helper functions must NOT be callable via PostgREST RPC.
-- Revoke from PUBLIC (anon/authenticated inherit from PUBLIC, so revoking only
-- those two is not enough). Triggers still fire — they don't need EXECUTE grants.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.refresh_answer_score() from public;
revoke execute on function public.rls_auto_enable() from public;

-- (c) is_verified_lecturer -> SECURITY INVOKER (it only reads profiles, which is
-- public-readable, so it still works inside RLS policies). Do NOT revoke this one.
create or replace function public.is_verified_lecturer(user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = user_id and role = 'lecturer' and lecturer_status = 'verified'
  );
$$;

-- (d) Drop the broad public-listing SELECT policy on storage. Public bucket URLs
-- still work (public buckets serve objects without this policy); this only removes
-- the ability to LIST every file.
drop policy if exists "Attachment files are public" on storage.objects;
