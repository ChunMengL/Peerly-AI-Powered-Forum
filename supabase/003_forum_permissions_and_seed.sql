-- Restores API access for the forum tables and ensures form options exist.
-- Run after 001_initial_schema.sql in the Supabase SQL editor.

grant usage on schema public to anon, authenticated;

grant select on table public.profiles to anon, authenticated;
grant update on table public.profiles to authenticated;

grant select on table public.subjects to anon, authenticated;
grant select on table public.tags to anon, authenticated;

grant select on table public.questions to anon, authenticated;
grant insert, update, delete on table public.questions to authenticated;

grant select on table public.question_tags to anon, authenticated;
grant insert, update, delete on table public.question_tags to authenticated;

grant select on table public.answers to anon, authenticated;
grant insert, update, delete on table public.answers to authenticated;

insert into public.subjects (name, slug)
values
  ('Computer Science', 'computer-science'),
  ('Mathematics', 'mathematics'),
  ('Business', 'business'),
  ('System Design', 'system-design')
on conflict (slug) do nothing;

insert into public.tags (name, slug)
values
  ('Python', 'python'),
  ('Database', 'database'),
  ('SQL', 'sql'),
  ('Algorithms', 'algorithms'),
  ('Linear Algebra', 'linear-algebra'),
  ('Proof', 'proof'),
  ('Accounting', 'accounting'),
  ('Marketing', 'marketing')
on conflict (slug) do nothing;
