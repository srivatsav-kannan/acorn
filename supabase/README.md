# Supabase setup

Acorn keeps all persistent state in Supabase. Accounts sign up and log in through the app's own forms, and every workspace read and write is enforced server-side. The fixture mode used by the browser tests is the only path that runs without a Supabase project.

## Configure

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` in numeric order with the Supabase CLI or SQL editor.
3. Enable email and password sign-in.
4. Set the Authentication site URL to the deployed origin.
5. Add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` URL to the redirect allow list.
6. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project's API settings.
7. For a shared demo account, sign one up through the app like any other account, confirm its email in the dashboard, and put its credentials in `COURSE_CONTEXT_DEMO_EMAIL` and `COURSE_CONTEXT_DEMO_PASSWORD` so the demo reset endpoint and the agent bridge can find it.
8. Restart the application, then verify signup, onboarding, persistence across reload, and the guarded workspace reset.

## Security model

Every account workspace read is membership-scoped by row-level security. Snapshot commits use an expected version and fail on concurrent modification. Each successful snapshot is also appended to immutable version history. Workspace creation is an authenticated security-definer operation that creates the owner membership and first snapshot atomically.

The demo is an ordinary account whose credentials are shared for judging. Reset behaves the same for every account: it preserves the Auth user, workspace, membership, and version history while returning the active workspace to onboarding.
