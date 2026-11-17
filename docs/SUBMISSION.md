# Portal submission

**Live URL:** https://decisionroom.app.space

**Repository:** https://github.com/Chenhuan-Tian/decisionroom

DecisionRoom helps a small group make a choice with a record of why: frame two or three options, save evidence, compare tradeoffs, vote, and record the host's final rationale. Changing evidence invalidates older AI comparisons; finalization freezes evidence and votes. The decision brief exports as Markdown.

I used DeepSpace authentication, realtime RecordRoom storage, native team RBAC, server actions, and a per-room Durable Object for ordered state transitions. Three external integrations serve the workflow: Exa finds candidate sources, OpenAI compares saved evidence with validated citation IDs, and Google Calendar creates an optional review event using the caller's own OAuth account. Media, payments, and extra messaging integrations would not add value here.

My main tradeoff was bounded, human-reviewed evidence over autonomous research. AI cannot choose the final answer, and valid citation IDs do not prove that a claim is true. A room waits during generation; background JobRoom execution would be the next scaling step. Ambiguous Calendar failures disable automatic retries to avoid duplicate events.

The coding agent implemented the interface, backend, tests, and documentation. I directed the scope, completed platform setup, and ran verification: 24 unit tests and 14 browser/API tests passed, including a real three-user privacy/collaboration flow. The first run exposed an SDK authentication-cache race and a test locator issue; after correction I reran the complete suite successfully. I also exercised the deployed core workflow and reported no issues.

Real Google Calendar consent/event creation is not separately confirmed in the verification record. Membership removal and recurring reviews are intentionally outside scope. Next I would verify Calendar explicitly, add reconciliation for uncertain writes, and move long generation into background jobs.

The repository is private; ensure the reviewers have access before submitting. Detailed evidence and limits: [VERIFICATION.md](VERIFICATION.md).
