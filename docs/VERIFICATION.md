# Verification

Last updated: November 17, 2026 (America/New_York).

| Check | Observed result |
| --- | --- |
| TypeScript, `tsc --noEmit` | Passed after the final implementation. |
| Unit tests, `npm run test:unit` | 24 passed across 4 files. Includes service authorization, native SDK read/write policies, bounded/idempotent evidence, caller-bound votes, stale comparisons, invalid citations, Calendar OAuth/ambiguity and prerendering. |
| Production build, `npm run build` | Passed after the final implementation; client and Worker bundles plus prerendered landing generated. |
| Browser landing | Rendered and visually inspected in the local browser. |
| Authenticated browser workflow | Passed through the real SDK browser suite, run by the applicant from a network-enabled terminal. |
| Native SDK three-user end-to-end test | Passed: private room exclusion, invitation join, realtime evidence, changing a single vote, rejected outsider/member actions, host finalization, frozen writes, persistence after reload and actual Markdown export content. The full browser/API suite passed 14/14 in 27.5 seconds. |
| Real Exa search | Not yet verified. Contract inspected via CLI. |
| Real OpenAI comparison | Not yet verified. Contract inspected via CLI; invalid citations tested with synthetic provider output. |
| Real Google OAuth and event creation | Not yet verified. Contract inspected; OAuth-required, ambiguous failures and repeated confirmed responses tested at the service boundary. No real calendar event has been created by the agent. |
| Deployment | Pending. |

The initial scaffold prerender tests failed because Windows sandbox temp paths contained `#` and braces, which Vite's file-URL loader misresolved. Their temporary fixtures now live under ignored `.local-runtime/test-temp`; both tests pass. This changed the test fixture location, not application behavior or assertions.

## Applicant's manual checks

Only check these after actually observing the behavior. Record any exception rather than replacing it with an optimistic pass.

- [ ] Open the returned live URL in a fresh browser, sign in, and create a room.
- [ ] In a different account, an ordinary room link reveals neither the question nor evidence.
- [ ] Accept an invitation in that second account; see a newly saved evidence card and changed vote without refreshing.
- [ ] Search once, open the actual source, review its note and save it.
- [ ] Generate one comparison and inspect every citation for factual support; reference validation alone is insufficient.
- [ ] Remove or add evidence; the old comparison becomes stale. Regenerate or explicitly decide manually.
- [ ] Finalize, refresh, and inspect the exported Markdown brief.
- [ ] Choose a real future review time, connect Google Calendar and confirm exactly one 30-minute event. Submitting again must not create a second event.
- [ ] Inspect the repository for credentials and be ready to explain the coordinator, native RBAC and Calendar ambiguity tradeoff.

Unit tests use an in-memory action-tools adapter. SDK policy tests invoke the SDK's actual permission functions. They do not replace the native real-record three-user test or live-provider verification.

The first native run caught a concurrent SDK auth-cache write and an overly strict label locator. Authenticated tests now run in one worker with the current isolated account label; the decision select is located by its combobox role and accessible name. The complete suite was rerun successfully at 00:18 Eastern on November 17. No failed or skipped product check was counted as passing.
