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
- 224 unit, property, integration, contract, security, infrastructure, component, and agent-sequence tests passed.
- Statement coverage: 94.67%.
- Branch coverage: 88.24%.
- Function coverage: 94.31%.
- Line coverage: 99.11%.
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
6. Search for CS 148 in Stanford and add it through the shared command path.
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
25. Create a clean account model from only a name and open-ended goal, with no fictional student plan, history, preferences, commitments, notes, or research.
26. Start from an empty plan and make the first real plan edit successfully.
27. Keep the visible goal and editable profile summary synchronized.
28. Edit a scenario unit limit and add and remove an external commitment through the semantic command journal.
29. Require student confirmation before completed-course history can change.
30. Browse nine Stanford program references without treating any program as the student's choice until they explicitly track it.
31. Hide Google sign-in when its provider flag is not enabled.
32. Reject an authenticated render that does not receive real account workspace data instead of falling back to the demo fixture.
33. Return the active account plan and scenario IDs to an agent before plan editing.
34. Edit any protected weekday or weekend day rather than assuming a Friday-only preference.

## Honest boundaries

- The Stanford reference layer includes a broader course and program index with official source links. Meeting and section examples remain illustrative planning samples and must be verified before registration.
- The application does not enroll in courses or send messages.
- Email magic-link login, callback exchange, clean account onboarding, workspace creation, protected routes, server persistence, sign-out, and conflict recovery are implemented. Google login is hidden unless its provider is explicitly enabled. The local app is connected to the hosted Supabase project and both migrations are applied. A complete fresh-account login still requires a user-controlled email link and has not been claimed as browser-verified.
- Public deployment, video recording, and Devpost submission remain release operations outside the local test suite.
