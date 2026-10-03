# Trending Community Edges

Installed rule: `community-recognition-v1`. This measures community interest, not estimated value, profitability, sporting likelihood or Top Docked rank. It never modifies official publications, competitive grading or a member's permanent history.

## Eligibility

Only genuine canonical `market_reference_v1` Community Edges are considered. The submission must precede the event, use `STANDARD_VERIFIED` current evidence and have complete retained source snapshots labelled market data, forward paper or live. Research/DEMO sources and the separate preview-fixture tables cannot qualify. A pending record must start within the next seven days.

Authors must have been members for seven days at submission. Author and engaging accounts must be active, verified, non-anonymous, non-banned, not disabled, have current community jurisdiction access, and expose a members-visible profile. QA `@example.invalid` identities are excluded. Removed/review/deleted posts, open or escalated reports, integrity review and promotional personal notes exclude discovery. These restrictions do not erase canonical loss records.

Viewer blocks and mutes hide author discovery. Viewer-hidden engaging profiles contribute no trending interest. Bilateral blocks between an actor and author exclude their engagement globally. Private, suspended, deleted or reported actors do not count. These are conservative discovery rules; a report holds discovery pending moderation rather than deleting a ledger record.

## Versioned interest score

Require at least three distinct eligible members other than the author. Each person's reaction contributes at most once, and comments contribute at most once per person; only visible, unreported comments of at least 20 trimmed characters count. This length threshold is an abuse guard, not proof of quality. The account must already be seven days old when the engagement occurs. Future and pre-submission timestamps are rejected.

`score = (4 × unique members + 2 × unique commenters + unique reactors) / 2^(hours since submission / 24)`

Show at most three records. Ties use the earlier submission and canonical ID. Raw reactions alone never decide ordering. No stake, wager, customer loss, payment, Pro membership or sportsbook credentials are collected for this score.

Eight or more distinct eligible actors whose first interactions arrive within any sliding 60-second window flag the record for burst review and exclude it from recognition. The window crosses clock-minute boundaries. Repeating one actor cannot increase the count. The daily staff screen lists held IDs; existing moderation/integrity controls remain responsible for review. The algorithm cannot reliably identify coordinated old accounts and is not described as bot-proof. Changing thresholds requires a new reviewed rule version.

## Implementation and bounds

The private SQL projection in `src/server/community-recognition-inputs.ts` uses existing account, source and ledger tables. `src/core/community-recognition.ts` is deterministic and shared by the read model and weekly capture. The query refuses more than 1,000 candidate records or 50,000 activity rows; it fails closed instead of ranking a truncated sample. These operational bounds must be revisited with measured scale.

No data means “No eligible trending Edges yet.” Service errors and legal restrictions are distinct from a genuinely empty eligible set. No public database views or browser payload access were added. The server returns only the selected presentation records, never raw provider payloads or engaging-member identities.

## Verification

Focused tests cover unique counts, self/young/future/hidden actors, sliding bursts, duplicate IDs and invalid clocks. Disposable PostgreSQL executes the actual projection SQL to verify banned accounts, complete non-DEMO evidence, moderation, promotions and blocks. Isolated DEMO browser fixtures test empty and populated mobile/desktop states; they never feed application storage or rankings. Final hosted acceptance is recorded separately under [Phase 5 QA](qa/phase5/).
