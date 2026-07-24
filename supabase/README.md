# Peerly Supabase Setup

Run `001_initial_schema.sql` in the Supabase SQL editor after creating your project.

Then configure Auth providers in Supabase Dashboard:

- Email/password: Authentication > Providers > Email
- Google: Authentication > Providers > Google
- LinkedIn/Apple: add later if available and approved for your app

Create one public storage bucket named `peerly-attachments`, or let the SQL create it if your project allows storage schema edits from the SQL editor.

Local `.env` values needed by Next.js:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
# Or, if your dashboard labels it as publishable:
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Do not commit `.env`.
