-- 007_profile_update_policy.sql
-- Verified lecturers could not update their own profile: the UPDATE policy's
-- WITH CHECK constrained the role/lecturer_status VALUES of the post-update
-- row, which a lecturer row can never satisfy. Replace it with ownership-only
-- RLS and enforce no-self-promotion with column-level UPDATE grants instead.

drop policy if exists "Users can update their own safe profile fields" on public.profiles;

create policy "Users can update their own profile"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id);

-- role / lecturer_status intentionally keep no UPDATE grant: only elevated
-- paths (service role / postgres) may change them.
revoke update on public.profiles from authenticated;
grant update (display_name, username, avatar_url, skill_level, preferences)
  on public.profiles to authenticated;
