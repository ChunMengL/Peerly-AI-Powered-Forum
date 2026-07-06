-- 005_community_grants.sql
-- The community tables (answer_votes, answer_verifications, answer_comments,
-- user_interactions) were created without base table privileges for the API
-- roles, so anon/authenticated only had REFERENCES/TRIGGER/TRUNCATE. Every
-- read/write therefore failed with "permission denied for table ..." BEFORE RLS
-- was ever evaluated. RLS is already enabled with the correct policies on all of
-- these tables and remains the security boundary; these grants only restore the
-- coarse table access that PostgREST needs, matching 003_forum_permissions.
-- Run after 004_security_hardening.sql in the Supabase SQL editor.

grant select, insert, update, delete on public.answer_votes         to authenticated;
grant select                         on public.answer_verifications to anon, authenticated;
grant insert, update                 on public.answer_verifications to authenticated;
grant select                         on public.answer_comments      to anon, authenticated;
grant insert, update, delete         on public.answer_comments      to authenticated;
grant insert                         on public.user_interactions    to authenticated;
