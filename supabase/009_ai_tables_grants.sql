-- 009_ai_tables_grants.sql
-- The 001 schema created ai_conversations / ai_messages / ai_response_drafts with
-- RLS policies, but the "authenticated" role was never granted table-level access,
-- so every query fails with 42501 before RLS is even evaluated (same bug class as
-- the community tables fixed in 005). RLS policies stay untouched and keep rows
-- scoped to their owners.

grant select, insert, update, delete on table public.ai_conversations to authenticated;
grant select, insert on table public.ai_messages to authenticated;
grant select, insert, update on table public.ai_response_drafts to authenticated;
