# Decision 0001: application and test stack

Status: accepted for the challenge implementation

Date: 2026-08-27

## Decision

Use Next.js 16 with React 19 and TypeScript for the application. Keep domain logic in framework-independent modules. Use Zod for all external and command boundaries.

Use a repository interface with two execution modes:

- Supabase Auth and Postgres for personal accounts and the permanent public demo account
- a deterministic local fixture adapter available only to the isolated automated-test server

The public demo is a real, explicitly marked Supabase account. It uses the same domain commands, persistence, action receipts, WebMCP handlers, and views as a personal account. Reset preserves the Auth user, workspace identity, membership, and immutable version history while returning the active workspace to onboarding. The local fixture adapter exists only so the full UI and WebMCP suite can run deterministically without mutating the shared production demo.

Use Vitest for unit, integration, contract, component, and agent-behavior tests. Use Testing Library for component behavior. Use Playwright and axe-core for browser, responsive, and accessibility verification.

Use first-party CSS and small application components. Do not introduce a general component library for the first release.

## Reasons

- Next.js provides one application boundary for pages, route handlers, and deployment.
- React supports the dense interactive planner and persistent WebMCP provider.
- Framework-independent domain modules let UI actions and agent tools call the same operations.
- A deterministic test adapter keeps browser regression tests repeatable without mutating a shared hosted account.
- Supabase provides email and password authentication, Postgres, and row-level security for both personal and demo accounts.
- Vitest and Playwright cover deterministic logic and the actual browser journey.
- First-party components make the visual language deliberate and keep the application from reading as a generic template.

## Production rules

- Authenticated routes use dynamic rendering.
- Tokens never enter local storage in configured production mode.
- The permanent demo account contains only fictional or evaluator-entered data.
- Browser fixture storage is enabled only when `COURSE_CONTEXT_E2E_FIXTURE=true` on the isolated test server.
- Production access checks occur in the server adapter and in row-level security.
- WebMCP handlers act through the active browser session and repeat authorization.
- Unsupported production configuration fails clearly instead of falling back to a shared workspace.

## Version baseline

Versions are locked in `package-lock.json`. The initial compatibility baseline is:

- Next.js 16.3
- React 19.2
- TypeScript 5
- Zod 4
- Vitest 4
- Playwright 1.62

## Rejected options

### Browser-only local storage as the only persistence

This would make the demo easy but would not establish an authorization or production persistence boundary.

### Browser storage for the public demo

This makes reset, cross-browser persistence, and account behavior diverge from the product. Browser storage remains acceptable only inside the isolated automated-test adapter.

### A separate API service for the challenge

The extra deployment and authentication seam adds risk without improving the demonstrated workflow. Domain and repository boundaries preserve a later extraction path.

### A large UI component library

The product needs a specific academic planning interface. A broad component library would add dependency and visual-default risk before the core surfaces are stable.

## Consequences

- Every domain operation must run against server persistence and the deterministic test adapter.
- Adapter contract tests are required, plus one live hosted demo acceptance journey.
- Fixture-mode browser results cannot be described as live Supabase verification.
- Production OAuth cannot be called verified until real credentials and a deployed callback are tested.
- The challenge demo requires the Supabase project, demo migration, and permanent demo Auth user to be healthy.
