# Portal submission draft

Replace the live URL after deployment and complete the personal verification paragraph before submitting. Do not submit unfinished placeholders as verified claims.

**Live URL:** pending verified deployment

**Repository:** https://github.com/Chenhuan-Tian/decisionroom

**What I built**

DecisionRoom is a private decision workspace for a small group: frame two or three options, save evidence, generate a comparison with source references, vote, and record the host's final rationale. Evidence changes invalidate old comparisons; finalized decisions freeze evidence and votes. A Markdown brief preserves the reasoning, and an optional Calendar review provides a date to revisit it.

**DeepSpace choices**

The app uses DeepSpace authentication, realtime RecordRoom storage, native team RBAC, server actions and a per-room Durable Object to serialize state transitions. Its three external integrations are Exa for candidate sources, OpenAI for comparisons based on saved notes, and Google Calendar for a review event. Google uses caller billing/OAuth so each host acts on their own account. Additional media, payment or messaging integrations would not improve this decision workflow.

**Main tradeoff**

I chose a bounded, human-reviewed workflow over autonomous research. Options are fixed, evidence is capped, and AI claims must cite known sources, while factual support remains a human check. A room's writes wait while generation runs; at this scale that simplifies consistent finalization. Calendar failures with an uncertain outcome do not automatically retry, because the exposed create contract provides no client idempotency key. The next step would be background generation and explicit Calendar reconciliation.

**Agent work and my verification**

The agent implemented the interface, backend rules, tests and documentation. I directed the project scope, completed platform setup, and ran the native verification suite: 24 unit tests and 14 browser/API tests passed, including a real three-user flow. The first run exposed an SDK authentication-cache race and a test locator error; after the agent corrected them, I reran the full suite successfully. [Add the live-provider paths you personally inspected and any changes you made. See VERIFICATION.md.]

**Remaining limitations**

[Carry forward any unverified provider/production paths from VERIFICATION.md.] Membership removal and recurring review are intentionally outside this submission. The app validates citation identity, not truth or semantic entailment.
