# Verification record

## Release candidate

Date: 2026-08-28

Command:

```bash
npm run test:all
```

## Result

Full green.

- ESLint passed.
- Strict TypeScript passed.
- 207 unit, property, integration, contract, security, infrastructure, component, and agent-sequence tests passed.
- Statement coverage: 95.03%.
- Branch coverage: 86.59%.
- Function coverage: 96.42%.
- Line coverage: 99.42%.
- The optimized Next.js build passed for 16 public, authentication, API, and workspace routes plus the not-found route.
- 26 browser journeys passed across desktop and mobile Chromium profiles.
- Two profile-specific assertions were skipped by design.
- Serious and critical accessibility violations: zero in both browser profiles.
- The in-app browser discovered all 11 WebMCP tools from the rendered Plan route.

## Verified journeys

1. Enter the isolated demo from the public landing page.
2. Navigate every primary workspace surface.
3. Capture a club in Library and see it immediately.
4. Remove Design Foundations from the plan and observe the unit change.
5. Open Activity and undo the plan mutation.
6. Search for CS 148 in Explore and add it through the shared command path.
7. See the selected course in Plan.
8. Inspect completed, planned, missing, and manual-review program requirements.
9. Open the cited official program link.
10. Register the six read tools and five mutation tools through `document.modelContext`.
11. Use mobile navigation, quick capture, and the schedule list alternative.
12. Search durable workspace context from the global command surface.
13. Compare two genuinely different quarter scenarios and open the lighter option.
14. Create a bounded saved view through the human command path and inspect its activity receipt.
15. Validate hosted-auth failure states and origin-safe callback redirects.
16. Validate every required Supabase table, RLS boundary, optimistic commit, history write, and cleanup restriction.
17. Edit a student profile and recover the change after reload.
18. Create, edit, archive, restore, and recover a Library item after reload.
19. Change program tracking status and recover it after reload.
20. Edit course role and units, rename a scenario, and recover both after reload.
21. Verify the WebMCP abort-signal lifecycle without duplicate tools during React remounts.
22. Verify that unconfigured account entry fails clearly instead of simulating success.
23. Save health-AI research through the actual WebMCP tool and require its exact returned ID to appear in workspace search and the Research Library collection.
24. Add a healthcare planning priority through WebMCP and verify that the student can see it in Settings on desktop and mobile.

## Honest boundaries

- Demo catalog and section data are illustrative and deterministic.
- The application does not enroll in courses or send messages.
- Google and magic-link login flows, callback exchange, account onboarding, workspace creation, protected routes, server persistence, sign-out, and conflict recovery are implemented. Hosted authentication still requires a Supabase project, both migrations, environment variables, and provider configuration before the real-account journey can be executed.
- Public deployment, video recording, and Devpost submission remain release operations outside the local test suite.
