# Peerly AI-Powered Forum FYP

Peerly is a Next.js forum prototype for study questions, AI-assisted learning signals, Google sign-in, and profile sessions.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Supabase PostgreSQL/Auth/Storage
- Google OAuth route handlers

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open http://localhost:3000.

## Google OAuth

In Google Cloud Console, use:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/auth/google/callback`

## Supabase

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

Run [supabase/001_initial_schema.sql](./supabase/001_initial_schema.sql) in the
Supabase SQL editor to create the first Peerly backend schema, RLS policies,
profile trigger, seed subjects/tags, and the attachment storage bucket.

## Known non-issues

- `npm audit` reports 2 moderate advisories ([GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93))
  from a PostCSS copy bundled inside Next.js 16 at `node_modules/next/node_modules/postcss`.
  PostCSS is a build-time tool and the XSS requires processing attacker-controlled CSS,
  which never happens here (all CSS is our own source), so it is not exploitable in this app.
  The only automated "fix" (`npm audit fix --force`) would downgrade Next.js to v9.3.3, a
  breaking change. Tracked as won't-fix until Next.js ships an updated PostCSS bundle —
  do not run `npm audit fix --force`.

## Routes

- `/` renders the migrated landing and question feed.
- `/login` renders the migrated sign-in/sign-up screen.
- `/profile` shows the signed-in user profile.
- `/auth/google/start` starts Google OAuth.
- `/auth/google/callback` handles the OAuth callback.
- `/auth/session` returns the current signed-in state.
- `/auth/logout` clears the local session.
- `/health` reports server and OAuth configuration status.
