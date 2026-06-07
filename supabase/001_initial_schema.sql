-- Peerly initial Supabase schema.
-- Run this in Supabase SQL Editor after creating the project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.user_role as enum ('student', 'general', 'lecturer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.lecturer_status as enum ('none', 'pending', 'verified', 'rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.question_status as enum ('open', 'answered', 'resolved', 'closed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.answer_source as enum ('user', 'ai');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_verdict as enum ('verified', 'disputed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.interaction_type as enum (
    'question_viewed',
    'search_performed',
    'question_created',
    'answer_created',
    'vote_cast',
    'comment_created',
    'preferred_answer_selected',
    'answer_saved',
    'ai_requested',
    'recommendation_clicked'
  );
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  username text unique,
  avatar_url text,
  role public.user_role not null default 'student',
  lecturer_status public.lecturer_status not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_lecturer_status_check check (
    (role = 'lecturer') or (lecturer_status in ('none', 'pending', 'rejected'))
  )
);

create table if not exists public.lecturer_verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  institution text,
  evidence_url text,
  note text,
  status public.lecturer_status not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete set null,
  preferred_answer_id uuid,
  title text not null,
  body text not null,
  status public.question_status not null default 'open',
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_title_length_check check (char_length(title) between 8 and 180)
);

create table if not exists public.question_tags (
  question_id uuid not null references public.questions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (question_id, tag_id)
);

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('system', 'user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_cache_entries (
  id uuid primary key default gen_random_uuid(),
  question_hash text not null unique,
  prompt text not null,
  response text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  usage_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_response_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  conversation_id uuid references public.ai_conversations(id) on delete set null,
  cache_entry_id uuid references public.ai_cache_entries(id) on delete set null,
  prompt text not null,
  response text not null,
  published_answer_id uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  source public.answer_source not null default 'user',
  body text not null,
  ai_draft_id uuid references public.ai_response_drafts(id) on delete set null,
  score integer not null default 0,
  is_low_quality boolean not null default false,
  is_collapsed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.questions
  drop constraint if exists questions_preferred_answer_id_fkey;

alter table public.questions
  add constraint questions_preferred_answer_id_fkey
  foreign key (preferred_answer_id) references public.answers(id) on delete set null;

alter table public.ai_response_drafts
  drop constraint if exists ai_response_drafts_published_answer_id_fkey;

alter table public.ai_response_drafts
  add constraint ai_response_drafts_published_answer_id_fkey
  foreign key (published_answer_id) references public.answers(id) on delete set null;

create table if not exists public.answer_comments (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.answer_votes (
  answer_id uuid not null references public.answers(id) on delete cascade,
  voter_id uuid not null references public.profiles(id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (answer_id, voter_id)
);

create table if not exists public.answer_feedback (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  helped boolean,
  style_label text,
  note text,
  created_at timestamptz not null default now(),
  unique (answer_id, user_id)
);

create table if not exists public.answer_saves (
  answer_id uuid not null references public.answers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (answer_id, user_id)
);

create table if not exists public.answer_verifications (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references public.answers(id) on delete cascade,
  lecturer_id uuid not null references public.profiles(id) on delete cascade,
  verdict public.verification_verdict not null,
  note text,
  created_at timestamptz not null default now(),
  unique (answer_id, lecturer_id)
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  bucket text not null default 'peerly-attachments',
  object_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  created_at timestamptz not null default now(),
  constraint attachments_parent_check check (
    (question_id is not null and answer_id is null) or
    (question_id is null and answer_id is not null)
  ),
  constraint attachments_mime_type_check check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  constraint attachments_size_check check (size_bytes <= 5242880)
);

create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  interaction_type public.interaction_type not null,
  question_id uuid references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.recommendation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  question_id uuid references public.questions(id) on delete cascade,
  answer_id uuid references public.answers(id) on delete cascade,
  algorithm_version text not null,
  rank_position integer,
  score numeric,
  clicked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists questions_author_idx on public.questions(author_id);
create index if not exists questions_subject_idx on public.questions(subject_id);
create index if not exists questions_status_created_idx on public.questions(status, created_at desc);
create index if not exists answers_question_idx on public.answers(question_id, created_at);
create index if not exists answer_votes_voter_idx on public.answer_votes(voter_id);
create index if not exists answer_comments_answer_idx on public.answer_comments(answer_id, created_at);
create index if not exists question_tags_tag_idx on public.question_tags(tag_id);
create index if not exists user_interactions_user_idx on public.user_interactions(user_id, created_at desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

drop trigger if exists answers_set_updated_at on public.answers;
create trigger answers_set_updated_at
before update on public.answers
for each row execute function public.set_updated_at();

drop trigger if exists answer_comments_set_updated_at on public.answer_comments;
create trigger answer_comments_set_updated_at
before update on public.answer_comments
for each row execute function public.set_updated_at();

drop trigger if exists answer_votes_set_updated_at on public.answer_votes;
create trigger answer_votes_set_updated_at
before update on public.answer_votes
for each row execute function public.set_updated_at();

drop trigger if exists ai_conversations_set_updated_at on public.ai_conversations;
create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

drop trigger if exists ai_cache_entries_set_updated_at on public.ai_cache_entries;
create trigger ai_cache_entries_set_updated_at
before update on public.ai_cache_entries
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_verified_lecturer(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = user_id
      and role = 'lecturer'
      and lecturer_status = 'verified'
  );
$$;

create or replace function public.refresh_answer_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_answer_id uuid;
  new_score integer;
begin
  target_answer_id = coalesce(new.answer_id, old.answer_id);

  select coalesce(sum(value), 0)
  into new_score
  from public.answer_votes
  where answer_id = target_answer_id;

  update public.answers
  set
    score = new_score,
    is_low_quality = new_score <= -3,
    is_collapsed = new_score <= -5
  where id = target_answer_id;

  return null;
end;
$$;

drop trigger if exists answer_votes_refresh_score_insert on public.answer_votes;
create trigger answer_votes_refresh_score_insert
after insert on public.answer_votes
for each row execute function public.refresh_answer_score();

drop trigger if exists answer_votes_refresh_score_update on public.answer_votes;
create trigger answer_votes_refresh_score_update
after update on public.answer_votes
for each row execute function public.refresh_answer_score();

drop trigger if exists answer_votes_refresh_score_delete on public.answer_votes;
create trigger answer_votes_refresh_score_delete
after delete on public.answer_votes
for each row execute function public.refresh_answer_score();

alter table public.profiles enable row level security;
alter table public.lecturer_verification_requests enable row level security;
alter table public.subjects enable row level security;
alter table public.tags enable row level security;
alter table public.questions enable row level security;
alter table public.question_tags enable row level security;
alter table public.answers enable row level security;
alter table public.answer_comments enable row level security;
alter table public.answer_votes enable row level security;
alter table public.answer_feedback enable row level security;
alter table public.answer_saves enable row level security;
alter table public.answer_verifications enable row level security;
alter table public.attachments enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_response_drafts enable row level security;
alter table public.ai_cache_entries enable row level security;
alter table public.user_interactions enable row level security;
alter table public.recommendation_events enable row level security;

create policy "Public profiles are readable"
on public.profiles for select
using (true);

create policy "Users can update their own safe profile fields"
on public.profiles for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role in ('student', 'general')
  and lecturer_status in ('none', 'pending', 'rejected')
);

create policy "Users can request lecturer verification"
on public.lecturer_verification_requests for insert
with check (auth.uid() = user_id);

create policy "Users can read their own lecturer requests"
on public.lecturer_verification_requests for select
using (auth.uid() = user_id);

create policy "Subjects are public"
on public.subjects for select
using (true);

create policy "Tags are public"
on public.tags for select
using (true);

create policy "Questions are public"
on public.questions for select
using (true);

create policy "Authenticated users can create questions"
on public.questions for insert
with check (auth.uid() = author_id);

create policy "Question authors can update their questions"
on public.questions for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Question authors can delete their questions"
on public.questions for delete
using (auth.uid() = author_id);

create policy "Question tags are public"
on public.question_tags for select
using (true);

create policy "Question authors can manage question tags"
on public.question_tags for all
using (
  exists (
    select 1 from public.questions
    where questions.id = question_tags.question_id
      and questions.author_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.questions
    where questions.id = question_tags.question_id
      and questions.author_id = auth.uid()
  )
);

create policy "Answers are public"
on public.answers for select
using (true);

create policy "Authenticated users can create answers"
on public.answers for insert
with check (auth.uid() = author_id);

create policy "Answer authors can update their own answers"
on public.answers for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Answer authors can delete their own answers"
on public.answers for delete
using (auth.uid() = author_id);

create policy "Answer comments are public"
on public.answer_comments for select
using (true);

create policy "Authenticated users can create answer comments"
on public.answer_comments for insert
with check (auth.uid() = author_id);

create policy "Comment authors can update their comments"
on public.answer_comments for update
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

create policy "Comment authors can delete their comments"
on public.answer_comments for delete
using (auth.uid() = author_id);

create policy "Answer votes are public"
on public.answer_votes for select
using (true);

create policy "Authenticated users can vote"
on public.answer_votes for insert
with check (auth.uid() = voter_id);

create policy "Voters can change their vote"
on public.answer_votes for update
using (auth.uid() = voter_id)
with check (auth.uid() = voter_id);

create policy "Voters can remove their vote"
on public.answer_votes for delete
using (auth.uid() = voter_id);

create policy "Users can manage their answer feedback"
on public.answer_feedback for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can manage saved answers"
on public.answer_saves for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Answer verifications are public"
on public.answer_verifications for select
using (true);

create policy "Verified lecturers can verify answers"
on public.answer_verifications for insert
with check (
  auth.uid() = lecturer_id
  and public.is_verified_lecturer(auth.uid())
);

create policy "Verified lecturers can update their verifications"
on public.answer_verifications for update
using (
  auth.uid() = lecturer_id
  and public.is_verified_lecturer(auth.uid())
)
with check (
  auth.uid() = lecturer_id
  and public.is_verified_lecturer(auth.uid())
);

create policy "Attachments are public"
on public.attachments for select
using (true);

create policy "Attachment owners can insert metadata"
on public.attachments for insert
with check (auth.uid() = owner_id);

create policy "Attachment owners can delete metadata"
on public.attachments for delete
using (auth.uid() = owner_id);

create policy "Users can manage their AI conversations"
on public.ai_conversations for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can read messages in their conversations"
on public.ai_messages for select
using (
  exists (
    select 1 from public.ai_conversations
    where ai_conversations.id = ai_messages.conversation_id
      and ai_conversations.user_id = auth.uid()
  )
);

create policy "Users can add messages to their conversations"
on public.ai_messages for insert
with check (
  exists (
    select 1 from public.ai_conversations
    where ai_conversations.id = ai_messages.conversation_id
      and ai_conversations.user_id = auth.uid()
  )
);

create policy "Users can manage private AI drafts"
on public.ai_response_drafts for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "AI cache can be read by authenticated users"
on public.ai_cache_entries for select
using (auth.role() = 'authenticated');

create policy "Users can insert their own interactions"
on public.user_interactions for insert
with check (auth.uid() = user_id);

create policy "Users can read their own interactions"
on public.user_interactions for select
using (auth.uid() = user_id);

create policy "Users can read their own recommendation events"
on public.recommendation_events for select
using (auth.uid() = user_id);

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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'peerly-attachments',
  'peerly-attachments',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Attachment files are public"
on storage.objects for select
using (bucket_id = 'peerly-attachments');

create policy "Authenticated users can upload attachment files"
on storage.objects for insert
with check (
  bucket_id = 'peerly-attachments'
  and auth.role() = 'authenticated'
);

create policy "Users can delete their own attachment files"
on storage.objects for delete
using (
  bucket_id = 'peerly-attachments'
  and owner = auth.uid()
);
