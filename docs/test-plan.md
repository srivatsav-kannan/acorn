# CourseContext test plan

This plan maps the architecture to executable evidence. A green build means every required layer has passed. It does not mean every future product idea has been implemented.

## Release gates

The release command is `npm run test:all`.

It must pass:

1. ESLint
2. TypeScript
3. Unit, integration, contract, component, security, and agent eval tests
4. Coverage thresholds
5. Production build
6. Desktop browser tests
7. Mobile browser tests
8. Accessibility scans

## Coverage targets

| Area | Line target | Branch target |
| --- | ---: | ---: |
| Planning checks | 100% | 100% |
| Requirement evaluator | 100% | 100% |
| Authorization and isolation | 100% | 100% |
| Command and receipt engine | 100% | 95% |
| WebMCP handlers | 95% | 90% |
| Search and evidence | 95% | 90% |
| All measured modules | 90% | 85% |

## Traceability matrix

### Architecture 2: scope

- Full quarter plan is represented by fixture and browser tests
- Notes, tasks, people, clubs, sources, and decisions are covered by context tests
- Programs and requirements are covered by rule-tree tests
- Consequential external actions are absent from the tool manifest

### Architecture 3: principles

- UI and tool command parity has a contract test
- Workspace-first search has agent-sequence evals
- Research persistence has integration and browser tests
- Source classifications have exhaustive enum and display tests
- Low-risk agent writes have receipt and undo tests
- Sensitive profile changes return confirmation-required
- Arbitrary view code is rejected

### Architecture 5 and 6: information architecture

- Every route renders and is keyboard reachable
- Header, navigation, quarter selector, search, activity, and account controls have component tests
- Desktop and mobile navigation have browser tests
- Global capture supports every allowed type
- Global search groups result types and preserves stable IDs

### Architecture 7: visual design

- Design tokens are asserted in browser styles
- Source scan rejects prohibited decorative patterns and user-visible punctuation
- Focus visibility and touch target size are checked in the browser
- Empty, loading, stale, error, rollback, and success fixtures are rendered
- axe-core finds no serious or critical violations

### Architecture 8: screens

- Landing page communicates the product and exposes both entry paths
- Onboarding can complete, skip, resume, and validate each step
- Home summarizes rather than duplicates the whole plan
- Plan supports scenarios, course edits, section changes, backups, and commitments
- Explore supports structured filters and a complete course inspector
- Library supports collection, document, context, source, and history views
- Programs supports requirement progress and comparison
- Activity supports filters and atomic undo

### Architecture 9: authentication

- Demo sessions are isolated
- Returning sessions restore the workspace
- Sign-out removes access
- Production adapter rejects incomplete configuration
- Session secrets are not persisted in local storage
- Authenticated pages are dynamic

### Architecture 10: collaboration

- Human and agent commands produce equivalent domain changes
- Every mutation has actor, version, receipt, changed IDs, summary, and undo state
- Stale versions fail without partial writes
- Bulk commands roll back atomically

### Architecture 11 and 12: context

- Agent sequences search before external research
- Durable information is saved
- Hidden reasoning is not accepted as a context type
- Placement and relationships are validated
- Agent attribution and confidence display correctly
- Every context type can be created, edited, archived, restored, and searched

### Architecture 13 and 14: academic data and evidence

- Course and offering identities remain separate
- Cross-list aliases resolve
- Source authority depends on the question
- Stale evidence remains visible but cannot prove current facts
- Dynamic research stays in the workspace overlay
- External instructions remain untrusted content

### Architecture 15: planner

- Unit limit
- Duplicate course
- Meeting conflict
- Commitment conflict
- Missing section
- Not offered
- Missing prerequisite
- Uncertain prerequisite
- Final conflict
- Day constraint
- Time constraint
- Transition buffer
- Backup exclusion
- Stale evidence
- Boundary times
- Multi-meeting sections
- Preservation of unrelated plan entries

### Architecture 16: programs

- All-of
- Any-of
- Choose-n
- Course
- Course group
- Minimum units
- Minimum grade
- Residency
- Manual review
- Planned differs from completed
- Double-count policy
- Effective catalog year

### Architecture 17: views

- Every allowed block validates
- Unsupported block rejects
- Unsupported layout rejects
- Cross-workspace query rejects
- Human editor and tool use the same validator
- Arbitrary HTML, CSS, JavaScript, and SQL reject

### Architecture 18: WebMCP

- Expected tool set
- Stable names
- Closed schemas
- Accurate annotations
- Concise descriptions
- Output budget
- Pagination
- Authorization
- Structured errors
- Visible UI change flag
- Registration and unregistration lifecycle

### Architecture 19 through 23: application, data, and versioning

- Query and command layer has no framework dependency
- Fixture importer is deterministic and idempotent
- Search avoids per-course fan-out
- Workspace export contains the required files
- Git remains source versioning rather than hidden user runtime state

### Architecture 24: security

- Tenant isolation
- URL protocol allowlist
- Private network blocking for metadata fetch
- Sanitized external text
- No secret or private fixture data
- Security headers
- Confirmation boundaries
- Tool authorization repeats server checks

### Architecture 25 through 27: quality

- Search and plan-check performance budgets have benchmark tests
- Responsive behavior is checked at five widths
- Keyboard, focus, reduced motion, and screen-reader states are checked
- Observability records operation names and codes without private text

### Architecture 28 through 32: verification

- Unit, contract, browser, and agent eval suites run from one command
- Exact demo happy path passes
- Recovery path passes
- Demo reset passes
- Public-facing claims are checked against the feature manifest

## Mutation matrix

Every mutation is tested for:

- valid human actor
- valid agent actor
- missing authorization
- malformed input
- missing target
- wrong workspace
- current version
- stale version
- first idempotency key
- repeated idempotency key
- successful receipt
- activity entry
- targeted cache invalidation
- undo where supported
- rollback on validation failure

## Browser matrix

| Journey | Desktop | Mobile |
| --- | --- | --- |
| Public landing and demo entry | yes | yes |
| Login and account recovery shell | yes | yes |
| Onboarding | yes | yes |
| Explore and filter | yes | yes |
| Create and repair plan | yes | yes |
| Quick capture | yes | yes |
| Save researched source | yes | yes |
| Program progress | yes | yes |
| Activity and undo | yes | yes |
| WebMCP registration | yes | capability check |
| Accessibility scan | yes | yes |

## Required failure fixtures

- empty workspace
- partial catalog
- stale offering evidence
- unsupported requirement rule
- plan version conflict
- repository failure during a bulk command
- expired demo session
- unauthorized workspace ID
- offline mutation
- malformed external URL
- prompt-injection text inside a saved source
- WebMCP unavailable
- tool output truncation and continuation

## Final report

The final verification writes:

- command results
- coverage summary
- browser project results
- axe summary
- tested Git commit
- fixture hash
- tool manifest hash
- unresolved limitations

The product is not described as complete while any hard gate fails.
