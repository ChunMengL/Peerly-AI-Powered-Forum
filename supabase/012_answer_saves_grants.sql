-- 012_answer_saves_grants.sql
-- The 001 schema created public.answer_saves with an owner-scoped RLS policy
-- ("Users can manage saved answers" FOR ALL using/with check auth.uid() = user_id),
-- but the "authenticated" role was never granted table-level access, so any save,
-- read, or unsave would fail with 42501 before RLS is even evaluated (same bug
-- class as the community and AI tables fixed in 005 and 009). RLS policies stay
-- untouched and keep rows scoped to their owners.

grant select, insert, delete on table public.answer_saves to authenticated;
