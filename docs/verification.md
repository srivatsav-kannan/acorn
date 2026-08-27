# Verification record

## Release candidate

Date: 2026-08-27

Command:

```bash
npm run test:all
```

## Result

Full green.

- ESLint passed.
- Strict TypeScript passed.
- 192 unit, property, integration, contract, security, infrastructure, component, and agent-sequence tests passed.
- Statement coverage: 95.32%.
- Branch coverage: 88.53%.
- Function coverage: 95.83%.
- Line coverage: 99.26%.
- The optimized Next.js build passed for 11 public, authentication, and workspace routes plus the not-found route.
- 14 browser journeys passed across desktop Chromium and mobile WebKit.
- Two profile-specific assertions were skipped by design.
- Serious and critical accessibility violations: zero in both browser profiles.
- The in-app browser discovered all 11 WebMCP tools from the rendered Plan route.

## Verified journeys

1. Enter the isolated demo from the public landing page.
2. Navigate every primary workspace surface.
3. Capture a club in Library and see it immediately.
4. Remove Design Foundations from the plan and observe the unit change.
5. Open Activity and undo the plan mutation.
6. Search for CS 147 in Explore and add it through the shared command path.
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

## Honest boundaries

- Demo catalog and section data are illustrative and deterministic.
- The application does not enroll in courses or send messages.
- Google and magic-link login flows plus the callback are implemented. Hosted authentication requires deployment environment variables and Supabase provider configuration.
- Public deployment, video recording, and Devpost submission remain release operations outside the local test suite.
