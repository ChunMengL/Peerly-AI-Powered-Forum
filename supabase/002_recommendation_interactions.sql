-- Adds interaction values used by the recommendation backend.
-- Run after 001_initial_schema.sql for existing Supabase projects.

alter type public.interaction_type add value if not exists 'tag_clicked';
alter type public.interaction_type add value if not exists 'search_performed';
alter type public.interaction_type add value if not exists 'answer_posted';
