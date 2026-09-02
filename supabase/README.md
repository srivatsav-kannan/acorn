# Supabase setup

Acorn keeps all persistent state in Supabase. Accounts sign up and log in through the app's own forms, and every workspace read and write is enforced server-side. The fixture mode used by the browser tests is the only path that runs without a Supabase project.

## Configure

1. Create a Supabase project.
2. Apply the migrations in `supabase/migrations/` in numeric order with the Supabase CLI or SQL editor. Migration 0004 names the two shared demo logins it protects, `julia.reyes@acorndemo.app` and `demo@coursecontext.app`. Change those literals to your own demo addresses before applying it, or the trigger protects nothing.
3. Enable email and password sign-in.
4. Set the Authentication site URL to the deployed origin. Links sent from the dashboard land there, and the app hands them on to the right page.
5. Add `http://localhost:3000/**` and the deployed origin with `/**` to the redirect allow list. The app sends reset and confirmation links to `/auth/callback`, and `/auth/confirm` handles email templates that link with a token hash instead of a code.
6. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project's API settings. Add `SUPABASE_SERVICE_ROLE_KEY` only if you run `scripts/accounts/admin-create-users.mjs`. It never reaches the app or the browser.
7. For a shared demo account, sign one up through the app like any other account, confirm its email in the dashboard, and put its credentials in `COURSE_CONTEXT_DEMO_EMAIL` and `COURSE_CONTEXT_DEMO_PASSWORD` so the agent bridge can log in.
8. Restart the application, then verify signup, onboarding, persistence across reload, the password reset email, and the guarded workspace reset.

## Security model

Every account workspace read is membership-scoped by row-level security. Snapshot commits use an expected version and fail on concurrent modification. Each successful snapshot is also appended to immutable version history. Workspace creation is an authenticated security-definer operation that creates the owner membership and first snapshot atomically.

The demo is an ordinary account whose credentials are shared for judging. Resetting the workspace preserves the Auth user, workspace, membership, and version history while returning the active workspace to onboarding. The demo login itself is frozen by a trigger on `auth.users` from migration 0004, so nobody holding the shared credentials can change its email or password, and the profile page hides the login-details card for demo workspaces.
