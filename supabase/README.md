# Supabase setup

CourseContext runs without external services in fixture mode. Supabase enables persistent accounts and server-enforced workspace isolation.

## Configure

1. Create a Supabase project.
2. Apply `supabase/migrations/0001_identity_and_workspace.sql` with the Supabase CLI or SQL editor.
3. Enable Google OAuth and email sign-in in Authentication.
4. Add the local and deployed `/auth/callback` URLs to the redirect allow list.
5. Copy `.env.example` to `.env.local` and set the public project URL and publishable key.

The service role key is only for trusted maintenance tasks such as expired demo cleanup. It must never be exposed through a `NEXT_PUBLIC_` variable or committed.

## Security model

Every workspace read is membership-scoped by row-level security. Snapshot commits use an expected version and fail on concurrent modification. Each successful snapshot is also appended to immutable version history. Expired demo deletion is not callable by ordinary application users.
