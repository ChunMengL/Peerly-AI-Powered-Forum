# Peerly AI-Powered Forum FYP

Peerly is a Next.js forum prototype for study questions, AI-assisted learning signals, Google sign-in, and profile sessions.

## Tech Stack

- Next.js App Router
- React
- TypeScript
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

Create a root `.env` file:

In Google Cloud Console, use:

- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/auth/google/callback`

## Routes

- `/` renders the migrated landing and question feed.
- `/login` renders the migrated sign-in/sign-up screen.
- `/profile` shows the signed-in user profile.
- `/auth/google/start` starts Google OAuth.
- `/auth/google/callback` handles the OAuth callback.
- `/auth/session` returns the current signed-in state.
- `/auth/logout` clears the local session.
- `/health` reports server and OAuth configuration status.
