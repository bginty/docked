# Edge of the Week

Rule `community-recognition-v1` is community recognition, not an official Docked tip, Top Docked rank, financial prize or future-return claim. The official complete-results page remains unchanged and includes losses.

## Complete-week criteria

The period is the last completed Monday 00:00 UTC to the following Monday 00:00 UTC, end exclusive. A selection must have an authorised, settled `WON` result recorded in that period and a positive return on its captured standard 1.00-unit benchmark. Pending, losing, void, disputed and manual-review results cannot win. Event commencement must precede settlement, and the original submission must precede commencement.

All [Trending eligibility guards](TRENDING_EDGES.md) apply: current standard Market Reference evidence, no promotional or DEMO source, no integrity flag, eligible mature account and visible moderated post. Require at least three eligible distinct engaged members before week end. Engagement after week end cannot change the week's ranking.

The author must also have at least 20 settled non-void standard Market Reference records across seven distinct UTC submission dates before week end. Wins and losses both count. Missing source snapshots, research/DEMO sources, promotions and flagged integrity records do not count toward that sample. Small samples receive no recognition.

## Ordering and audit

Order by distinct eligible engaged members, then positive one-unit net return capped at 3 units for this tie-break only, then earlier submission and canonical ID. Capping does not change the actual recorded return. A 501.0 longshot cannot outrank an equally supported 4.0 record merely because of its larger payout.

An owner, administrator or analyst with genuine MFA may capture a complete-week snapshot from Daily operations. The action accepts no winner, odds, probability or result. It calculates from canonical records and stores the rule, period, observation time, evidence IDs, counts and SHA-256 payload hash in the immutable, RLS-protected `private.community_recognition_snapshots` table. Display names and handles are not frozen into the audit payload. Auditors may inspect operations but cannot capture. No notification is sent.

The first snapshot for the rule/week is the published decision. Before a snapshot, an eligible nominee is labelled as awaiting audited review, not awarded automatically. A snapshot with no qualifier remains an honest no-award decision. Later snapshots are additional audit evidence and do not silently replace the first winner. A future correction/reissue mechanism requires explicit versioned policy; it has not been enabled here.

The winner is determined globally before viewer visibility. A blocked/private/deleted, moderated, newly flagged or corrected winner is withheld; a viewer never receives a substitute runner-up. Revalidation that changes the global eligible ordering also withdraws the recognition. Current identity visibility is checked on every read. Canonical historical records and snapshot evidence remain retained under existing audit rules.

If nothing qualifies, the UI says **NO EDGE OF THE WEEK YET**. Zero awards is a valid result. No selections or engagement are manufactured to produce one.

## Validation status

Pure tests exercise complete-week boundaries, positive results, samples, capped tie-break, post-week engagement and privacy withdrawal. SQL predicate tests use a disposable local PostgreSQL engine. No real award or public sporting-performance data have been seeded; actual hosted coverage is recorded in [Phase 5 QA](qa/phase5/).
