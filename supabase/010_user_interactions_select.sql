-- 010_user_interactions_select.sql
-- The behavioral recommendations route reads the caller's own interaction
-- history, but 005 granted only INSERT, so signed-in reads fail with 42501
-- before RLS runs. The owner-scoped SELECT policy from 001 ("Users can read
-- their own interactions", auth.uid() = user_id) already limits visible rows.
grant select on public.user_interactions to authenticated;
