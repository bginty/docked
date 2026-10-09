> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Top Docked: reproducible community performance

Phase 3, 3 October 2026. No genuine community results are connected. Empty/unconfigured states are intentionally not populated with sample winners, ranks or analytics. Historical performance is descriptive and does not guarantee future results.

## Canonical inputs and formulas

Top Docked consumes only the separate immutable community Edge ledger with `STANDARD_VERIFIED`, `community-standard-v1` and exactly one standard unit, together with its latest authorized settlement as of the requested instant. Demo, promotional, unverified, official Docked and self-reported records are excluded. Official strategy performance remains separate. Commentary removal, social blocks, privacy changes, suspension and personal data deletion never remove canonical losses from metrics. Protected identities are pseudonymised instead. Followers, subscription price and real-money wagers are not inputs.

For each settled non-void Edge, a win contributes decimal odds minus 1 and a loss contributes -1. A void contributes 0 and is reported separately. ROI is net standard units divided by the number of non-void settled one-unit records, multiplied by 100; hit rate is wins over that same denominator. Average odds is the mean across those settled non-void records. Pending, disputed and manual-review records are counted explicitly and never guessed into wins or losses. No settled data yields null performance, not an invented 0% result.

The cumulative curve uses settlement-record time and a deterministic ID tiebreaker. Maximum drawdown is the largest fall from the running peak beginning at zero. Longest losing run counts consecutive losses, with voids leaving the run unchanged. Profile periods use submission time, so a correction or late settlement does not move an Edge into a new submission cohort. Corrections recompute the current canonical view using the latest authorized outcome. They cannot rewrite a previously captured snapshot.

## Installed ranking rule

`top-docked-net-units-v1` requires at least **20 settled non-void records across 7 distinct UTC submission days** within the selected period. Smaller samples are PROVISIONAL and unranked. An unresolved integrity review, disputed or manual-review result makes the profile INTEGRITY_REVIEW and unranked while its complete outcomes remain visible. No ROI target is imposed.

Qualified members sort by exact Decimal net units descending, then exact maximum drawdown ascending, then durable profile ID ascending. Rounding is presentation-only: sub-cent differences from prices with more than two decimals retain their proper ordering. Rule changes require a new immutable version and documented recalculation, not editing the installed definition. This initial net-unit ranking is transparent descriptive competition, not a statistical claim of predictive skill or a paid placement system.

`week` is UTC Monday-to-date, `month` UTC calendar month-to-date, `ytd` UTC year-to-date. `7d`, `30d`, `90d` are rolling intervals ending at `asOf`; `all` has no lower bound. Sport filters use canonical sport IDs. Profile period and sport breakdowns use the same engine and whole canonical record source.

## Audit workflow and correction semantics

The current board is calculated from canonical records on each request and does not reuse stale cached performance. Thus authorized result corrections and integrity reviews are reflected on the next read. Snapshot capture is a separate reviewed action:

```json
POST /api/top-docked
{"action":"snapshot","period":"month","reason":"Reviewed canonical monthly community record"}
```

Optional `sport` narrows coverage. Verified MFA owner/admin access, rate limits and a bounded body are required. The server reads the database clock and canonical inputs in a repeatable-read transaction, verifies the installed rule configuration, and stores the source hash, calculated snapshot hash, exact rule version, period, sport, `asOf`, row Edge IDs, settlement IDs, actor, reason and prior same-scope snapshot link. The old snapshot is immutable. Current re-evaluation uses current evidence; replaying an older `asOf` uses only settlement/status revisions recorded on or before that instant, preventing a later correction from contaminating the historic snapshot.

`GET /api/admin/community-edges?view=leaderboard-audit` lists snapshot identities/hashes/history for MFA owner/admin/auditor roles. `?view=leaderboard-snapshot&id=<UUID>` exports one full immutable payload for review. No member or staff API accepts manually supplied rank, net units or snapshot payload. Exact canonical records remain accessible to trusted server queries for reproduction, subject to approved legal retention.

Comparable captured snapshots atomically create a durable milestone job. The in-app worker processes at most 50 recipient rows per batch, resumes its cursor after a successful transaction, and applies the existing category preference, current regional approval, pause, quiet hours and daily cap. It rechecks current canonical qualification before notifying. The first snapshot, unchanged qualifications, integrity-review clearance alone and different calendar/rolling windows produce no milestone. Messages describe meeting the published sample rules or a reviewed qualified ranking change; they contain no ROI target, winning-streak encouragement or wagering instruction. Per-window qualification and per-evidence ranking dedupe prevent snapshot/retry spam. Jobs older than 24 hours or from an elapsed window are suppressed. External delivery remains disabled.

## Discovery and badges

The board/profile read models derive badges from qualified canonical evidence. TOP_100 requires a qualified rank of 100 or better for the stated period. RISING additionally requires an actual earlier audited snapshot of the same rule/period/sport and identical lower window boundary, improved rank and new canonical Edge IDs. Comparing September with October is disallowed. Rolling windows with a different lower boundary are also conservatively incomparable. Without a comparable earlier snapshot, no rising claim is made. A sport-specialist badge requires a sport-filtered qualified sample of at least 50 non-void settled Edges across 14 UTC days. Badges retain rule version and source Edge IDs; they are not sold and do not grant predictive credibility. Most-followed discovery is a social count, distinctly separate from performance qualification. Only the fixed reserved Docked identity receives official status.

## Validation and remaining work

Pure regression tests cover exact Decimal ranking, one-unit P/L, ROI denominator, voids, losing runs/drawdown, sample gates, UTC periods, invalid timestamps, duplicate IDs, future settlement rejection, retained reviewed losses and correction recalculation. PostgreSQL tests exercise immutable evidence, session/role and jurisdiction guards, unknown/promotional data rejection, source approval/revocation and linked correction audit. Real concurrent PostgreSQL sessions, licensed provider replay and authenticated hosted preview flows remain external validation work; no genuine strategic edge or member profitability has been established.

The initial pilot computes the full canonical board in memory. Profile overall and sport breakdowns share one source query through `profilePerformanceBundle`, with no per-member database query loop. This is correctness-first pilot readiness, not a claim of 50,000-member throughput. Before opening at scale, use the immutable snapshot machinery with incremental current projections, bounded board pagination and load tests while preserving correction invalidation and complete input evidence. Profile rank/badges additionally require the viewer's `leaderboards` feature approval; ordinary approved performance access alone does not bypass that gate.
