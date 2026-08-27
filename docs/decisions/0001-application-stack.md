# Decision 0001: application and test stack

Status: accepted for the challenge implementation

Date: 2026-08-27

## Decision

Use Next.js 16 with React 19 and TypeScript for the application. Keep domain logic in framework-independent modules. Use Zod for all external and command boundaries.

Use a repository interface with two runtime modes:

- deterministic local demo storage for development, tests, previews, and a credential-free judge path
- Supabase Auth and Postgres adapters for configured production accounts

The local demo path is a real product mode, not a UI mock. It uses the same domain commands, validation, action receipts, WebMCP handlers, and views as the configured production path. Each demo session receives an isolated clone of the canonical fixture.

Use Vitest for unit, integration, contract, component, and agent-behavior tests. Use Testing Library for component behavior. Use Playwright and axe-core for browser, responsive, and accessibility verification.

Use first-party CSS and small application components. Do not introduce a general component library for the first release.

## Reasons

- Next.js provides one application boundary for pages, route handlers, and deployment.
- React supports the dense interactive planner and persistent WebMCP provider.
- Framework-independent domain modules let UI actions and agent tools call the same operations.
- A deterministic local path keeps the full challenge demo runnable without third-party credentials.
- Supabase provides Google, email, anonymous sessions, Postgres, and row-level security when configured.
- Vitest and Playwright cover deterministic logic and the actual browser journey.
- First-party components make the visual language deliberate and keep the application from reading as a generic template.

## Production rules

- Authenticated routes use dynamic rendering.
- Tokens never enter local storage in configured production mode.
- Demo storage never contains private student data.
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

### Supabase as the only runtime

This would make the local and judge demo depend on external project configuration. It would also prevent complete verification in a clean checkout without credentials.

### A separate API service for the challenge

The extra deployment and authentication seam adds risk without improving the demonstrated workflow. Domain and repository boundaries preserve a later extraction path.

### A large UI component library

The product needs a specific academic planning interface. A broad component library would add dependency and visual-default risk before the core surfaces are stable.

## Consequences

- Every domain operation must run against both repository modes.
- Adapter contract tests are required.
- Local demo behavior cannot be described as production account security.
- Production OAuth cannot be called verified until real credentials and a deployed callback are tested.
- The challenge can still ship through the self-contained isolated demo path if production account configuration is delayed.
