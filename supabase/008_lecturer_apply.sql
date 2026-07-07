-- 008_lecturer_apply.sql
-- Lecturer verification application flow.
-- Run after 007_profile_update_policy.sql.

-- (a) Application detail columns. Legacy evidence_url stays as-is.
alter table public.lecturer_verification_requests
  add column if not exists school_email text,
  add column if not exists staff_id text,
  add column if not exists evidence_paths jsonb not null default '[]'::jsonb;

-- (b) Base table grants. The table was created without privileges for the API
-- roles (same bug class 005 fixed for the community tables), so every
-- insert/select failed with "permission denied" before RLS was evaluated.
-- RLS (insert own / select own, from 001) stays the security boundary.
-- No update/delete: reviewing is admin-side only.
grant select, insert on table public.lecturer_verification_requests to authenticated;

-- (c) One live application per user.
create unique index if not exists lvr_one_pending_per_user
  on public.lecturer_verification_requests(user_id)
  where status = 'pending';

-- (d) Applying flips the applicant's profile to pending. Clients have no
-- UPDATE grant on profiles.lecturer_status (007), so a SECURITY DEFINER
-- trigger owned by postgres does it.
create or replace function public.handle_lecturer_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set lecturer_status = 'pending'
  where id = new.user_id
    and role <> 'lecturer'
    and lecturer_status in ('none', 'rejected');

  return new;
end;
$$;

-- Must not be callable via PostgREST RPC; triggers fire without EXECUTE
-- (same pattern 004 used for handle_new_user).
revoke execute on function public.handle_lecturer_application()
  from public, anon, authenticated;

drop trigger if exists lecturer_requests_set_pending
  on public.lecturer_verification_requests;
create trigger lecturer_requests_set_pending
after insert on public.lecturer_verification_requests
for each row execute function public.handle_lecturer_application();

-- (e) PRIVATE evidence bucket. peerly-attachments is public - evidence
-- documents must never go there.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lecturer-evidence',
  'lecturer-evidence',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do nothing;

-- Owner-folder access only (objects live under {user_id}/...). No public
-- read and no broad listing policy; admins review via dashboard/signed URLs.
drop policy if exists "Users can upload their own lecturer evidence" on storage.objects;
create policy "Users can upload their own lecturer evidence"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lecturer-evidence'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can read their own lecturer evidence" on storage.objects;
create policy "Users can read their own lecturer evidence"
on storage.objects for select to authenticated
using (
  bucket_id = 'lecturer-evidence'
  and auth.uid()::text = (storage.foldername(name))[1]
);
