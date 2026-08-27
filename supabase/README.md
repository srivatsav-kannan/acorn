# Supabase setup

CourseContext runs without external services in fixture mode. Supabase enables persistent accounts and server-enforced workspace isolation.

## Configure

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_identity_and_workspace.sql` and then `supabase/migrations/0002_account_onboarding.sql` with the Supabase CLI or SQL editor.
3. Enable email sign-in. Enable Google OAuth if you want the Google entry path.
4. Set the Authentication site URL to the deployed origin.
5. Add `http://localhost:3000/auth/callback` and the deployed `/auth/callback` URL to the redirect allow list.
6. Copy `.env.example` to `.env.local` and set the public project URL and publishable key.
7. Restart the application, create a new account, complete onboarding, sign out, and sign back in to verify recovery.

The service role key is only for trusted maintenance tasks such as expired demo cleanup. It must never be exposed through a `NEXT_PUBLIC_` variable or committed.

## Security model

Every account workspace read is membership-scoped by row-level security. Snapshot commits use an expected version and fail on concurrent modification. Each successful snapshot is also appended to immutable version history. Workspace creation is an authenticated security-definer operation that creates the owner membership and first snapshot atomically.

The public demo does not use Supabase. Its resettable fixture is stored in the current browser profile and never contains a real account token.
