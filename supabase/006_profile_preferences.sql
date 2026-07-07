-- 006_profile_preferences.sql
-- Self-reported personalization fields for the Phase 2 LLM tutor.
-- skill_level: nullable (unset = unknown).
-- preferences: free-form jsonb; known keys are explanation_style and goal.

alter table public.profiles
  add column if not exists skill_level text
    check (skill_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists preferences jsonb not null default '{}'::jsonb;
