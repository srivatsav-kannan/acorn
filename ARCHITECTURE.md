# Architecture

Acorn is a Next.js application with one workspace document per account, stored in Supabase Postgres as a versioned JSON snapshot, and one domain command path that both the interface and the WebMCP tool surface call. This document describes what is running. The requirements it satisfies are in `CONTEXT.md`.

## Stack

- Next.js 16 App Router, React 19, TypeScript, deployed on Vercel.
- Supabase Auth with email and password, and Supabase Postgres with row-level security, reached through `@supabase/ssr` on the server and in the browser.
- First-party CSS in `src/app/globals.css`, set in Fraunces and Karla from `next/font`.
- Vitest for unit, integration, contract, and agent-sequence tests. Playwright with axe-core for browser journeys.
- No component library, no state library, no schema library. Validation is hand-written in the domain layer and expressed as closed JSON Schemas on the tool surface.

## Routes

Public:

| Path | Purpose |
|---|---|
| `/` | Landing. Hands an auth code or a session in the URL hash to the right place. |
| `/signup`, `/login` | Account creation and sign-in. Login offers a confirmation resend and a password reset link. |
| `/forgot-password`, `/reset-password` | Request a reset email, then set a new password once the link has created a session. |
| `/auth/callback` | Exchanges an auth code for a session. Bounces spent links to a plain explanation. |
| `/auth/confirm` | Verifies token-hash links for email templates that use them. |
| `/onboarding` | The form an account sees after a workspace reset. Signed-in accounts with a workspace are sent to `/app`. |
| `/demo`, `/start` | Test-only entries for the browser fixture. In production they redirect to login. |

Workspace, behind `src/proxy.ts`, which verifies the session on every request:

| Path | Tab |
|---|---|
| `/app` | Calendar |
| `/app/academics` | Academics |
| `/app/activities` | Activities |
| `/app/scratchpad` | Scratchpad |
| `/app/collaborate` | Collaborate |
| `/app/profile` | Profile, with login details and the workspace reset |

Any other path under `/app` resolves to the closest tab through `src/app/app/[...missing]/page.tsx`, so an agent that guesses a tab name still lands inside the workspace where the tools are registered.

API route handlers, each of which re-derives the user from the session cookie before touching data:

| Route | Purpose |
|---|---|
| `POST /api/onboarding` | Creates the account's workspace through `create_personal_workspace`, or completes onboarding after a reset. |
| `GET`, `PUT /api/workspace` | Reads the current snapshot and commits the next one with an expected version. |
| `GET /api/workspace/head` | Returns the current version, used to reconcile after a timed-out commit. |
| `POST /api/account/reset` | Returns a workspace to onboarding. Refused for the shared demo workspace. |
| `POST /api/auth/signout` | Ends the session and clears fixture cookies. |
| `POST /api/demo/reset` | Server-side reset for the permanent demo identity defined in migration 0003. |

## The workspace

One JSON document, typed in `src/domain/workspace/types.ts`, holds everything a student and an agent touch: profile and timeline, preferences and protected hours, academic history including AP, IB, and transfer credit, goals with milestones, todos, events, activities, one plan per quarter with scenarios and chosen sections, context items and research on the scratchpad, the reference overlay of agent-added or corrected courses, sections, programs, and directory entries, saved views, and the ledger of receipts.

The database keeps seven tables, all with row-level security: `users`, `workspaces`, `workspace_memberships`, `terms_acceptances`, `workspace_snapshots`, `workspace_versions`, and `demo_sessions`. The current document is the row in `workspace_snapshots`. Every commit goes through `commit_workspace_snapshot`, which requires the version the caller started from, raises a conflict otherwise, and appends the new document to `workspace_versions`, which nothing can update or delete. Workspace creation runs through a security-definer function that creates the workspace, the owner membership, and the first snapshot atomically. Migrations live in `supabase/migrations/` and are described in `supabase/README.md`.

## One command path

Every change, from either participant, is a command executed by `src/domain/workspace/commands.ts` against the in-memory repository in `src/store/memory-repository.ts`:

1. The caller supplies the command, the version it started from, and an idempotency key.
2. The command validates its input against the current workspace and applies it, producing a receipt that names the actor, the affected items, and enough to undo it.
3. `src/components/workspace-provider.tsx` persists the new snapshot through `PUT /api/workspace` with the expected version. A stale version comes back as a conflict, and the local state rolls back.
4. Success lands in the ledger, which the Activity drawer renders with attribution and a one-step undo of the latest receipt.

Interface clicks call this path through the provider's `onCommand`. Tool calls call the same path through `src/webmcp/tools.ts`. All mutations in a session, clicks and tool calls alike, serialize through one gate, so concurrent changes cannot race into version conflicts. Attribution comes from the session, never from tool input: a tool call is always the agent, a click is always the student.

## The WebMCP surface

`src/webmcp/register.ts` registers every tool on `document.modelContext` when the workspace provider mounts, and unregisters on unmount, so the tools are live on every workspace tab. `src/webmcp/tools.ts` defines twenty-two tools with closed JSON Schemas (`additionalProperties: false`) and accurate read-only annotations:

- Read: `search_workspace`, `get_planning_context`, `search_courses`, `get_plan`, `check_plan`, `suggest_sections`, `get_program_progress`, `export_context`.
- Write: `edit_plan`, `manage_todo`, `manage_event`, `manage_activity`, `set_interest`, `annotate_course`, `ingest_context`, `save_research`, `save_workspace_item`, `update_student_context`, `extend_reference`, `configure_view`, `undo`, `manage_goal`.

Reads return concise structured results with stable IDs and the current version. Writes require `expectedVersion` and `idempotencyKey`, return a receipt, and replay the original receipt when a key is reused with the same payload. `export_context` pages the whole workspace out as markdown in sections of about five thousand characters, and `ingest_context` files context handed over from another assistant into the scratchpad. `check_plan` and `suggest_sections` are deterministic: schedule overlap, protected hours, prerequisite sequencing, unit limits, and WAYS coverage come from application code.

The Collaborate tab shows connection status, the tool table, and a copyable first prompt. For browsers without WebMCP, `scripts/bridge/agent-bridge.mjs` opens a Chromium with `document.modelContext` installed and serves the registered tools over local HTTP, as described in `README.md`.

## Reference data

`src/data/institutions/` holds the Stanford reference layer: the 2026-2027 catalog of 15,618 courses across 256 departments in `stanford/catalog.json`, imported from the public ExploreCourses feed by `scripts/import-stanford/import-catalog.mjs`, with real section times for the departments that publish them, official registrar dates, AP and IB credit tables, program requirement trees, WAYS designations, and a directory of clubs and research programs. The importer refreshes the JSON from the live feed and falls back to its cache. Agents extend or correct this layer per workspace through `extend_reference`, and the interface shows every amendment against the shipped original.

Timeline math lives in `src/domain/planning/timeline.ts` and `src/domain/planning/degree-plan.ts`: term identity, standing, the current term, units toward degree, and the carry-forward of completed and planned work through every quarter to graduation.

## Authentication and protection

Accounts are Supabase Auth email and password. Signup creates the workspace immediately through `/api/onboarding`, or after email confirmation when the project requires it. Password reset and confirmation links are built from the page's own origin, so they return to the deployment in use. Spent links land on the forgot-password page with an explanation, and dashboard-sent links that arrive with the session in the URL hash are handed to the reset page by the landing.

The profile page changes a password only after proving the current one with a sign-in, and changes an email through Supabase's double confirmation. The shared judging account is frozen twice: migration 0004 adds a trigger on `auth.users` that refuses email and password changes for it, and the workspace reset refuses to erase its seeded history.

`src/proxy.ts` verifies the session for every `/app` and `/onboarding` request. Session cookies are marked `Secure` in production. Responses carry `X-Frame-Options: DENY`, a `frame-ancestors 'none'` policy, `nosniff`, a strict referrer policy, and a restrictive permissions policy. The only secrets in the browser are the public Supabase URL and publishable key. The service role key is read by one admin script and never by the app.

## Testing

`npm run test:all` runs lint, strict TypeScript, Vitest with coverage gates on the domain, data, WebMCP, and store layers, the production build, and the Playwright journeys.

- `tests/unit` covers commands, timeline math, scheduling, search, evidence, reference amendments, and components.
- `tests/integration` runs commands end to end against the repository.
- `tests/contracts` pins the tool schemas and registration, the migration guarantees, the authentication rules, and source conformance such as the ban on decorative interface patterns.
- `tests/evals` replays agent tool sequences against the workspace.
- `tests/browser/demo.spec.ts` drives the app on desktop and mobile Chromium against a fixture workspace enabled by `COURSE_CONTEXT_E2E_FIXTURE=true`, with serious and critical accessibility checks. The flag cannot arm itself in a production build.

## Repository map

```text
src/
  app/                    Next.js routes and route handlers, global styles
    api/                  onboarding, workspace, account reset, sign-out, demo reset
    app/                  the workspace tabs, one thin page per feature
    auth/                 callback and confirm handlers for email links
    login, signup, forgot-password, reset-password, onboarding
  components/
    shell/                top bar, navigation, skeletons, reveal animation
    workspace-provider    state, persistence, the one mutation gate, tool registration
    icons                 the marks and glyphs
  features/               one folder per screen
    landing, auth, onboarding, calendar, academics, activities,
    scratchpad, collaborate, profile
  domain/
    workspace/            types, commands, context items, goals, history,
                          evidence, views, search, reference overlay, url guard
    planning/             planner checks, section scheduler, degree plan,
                          requirements, timeline, timezone, calendar, ics
  data/
    institutions/         registry and types for institution reference packs
      stanford/           catalog (15,618 courses), academic calendar, AP credit
    workspace/            the empty personal workspace and the test fixture
  store/                  in-memory repository the commands run against
  webmcp/                 tool definitions, registration, markdown export
  lib/                    Supabase clients, redirect guard, workspace loading
  proxy.ts                session verification for workspace routes
supabase/migrations/      schema, policies, functions, the demo login guard
scripts/
  import-stanford/        catalog importer with its own cache
  accounts/               admin account creation and scripted onboarding
  bridge/                 the terminal bridge for browsers without WebMCP
tests/
  unit/                   planning, workspace, data, components
  integration/            commands end to end against the repository
  contracts/              tool schemas, migrations, auth rules, source conformance
  evals/                  agent tool sequences and their harness
  browser/                Playwright journeys, desktop and mobile
submission/               the Devpost submission, mirrored as markdown
docs/                     product brief and the stack decision record
```
