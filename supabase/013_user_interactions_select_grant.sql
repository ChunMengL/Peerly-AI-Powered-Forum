-- 013_user_interactions_select_grant.sql
-- Already applied live on 2026-07-10 (migration "user_interactions_select_grant");
-- this file exists for repo/DB parity.
--
-- The behavioral recommendations route reads the caller's own interaction
-- history, but 005 granted only INSERT, so signed-in reads failed with 42501
-- before RLS ran. The owner-scoped SELECT policy from 001 ("Users can read
-- their own interactions", auth.uid() = user_id) already limits visible rows.
grant select on public.user_interactions to authenticated;
