# NFL current-roster eligibility and test cleanup

Policy: `official-nfl-roster-v1`. Local implementation and evidence dated 17 October 2026; hosted activation is not authorised by this task.

## Identity, acquisition and gameplay are separate

The seven-player NFL configuration supports QB, RB, WR and TE. FLEX is a slot for RB/WR/TE, not a player position. Kickers, punters, defence and other positions cannot be newly issued. Existing FB/HB source labels may match an already verified fantasy RB; preserve the fantasy classification. No scoring weights, formation or eligibility rules for settled entries change.

Active, verified team-listed players in supported positions may enter the acquisition pool, subject to existing product release, freshness, duplicate and permanent-supply limits. Official reserve/IR/PUP/NFI/suspended players retain their team identity and have a separate reserve availability state. They are not classified as retired or removed for injury. Practice-squad players retain identity but cannot be newly issued until a verified official elevation. This initial acquisition gate selects active-roster status only. A healthy scratch, bye or missing game statistic is not a roster-status change.

Released/unsigned/retired/unsupported players cannot be newly issued. Unverified or contradictory mappings are quarantined from issuance, never deleted merely because they failed a name or statistics match. Historical feed identities do not create collectible identities. Unknown roster status does not overwrite a player's historical statistics.

## Evidence and refresh

Official team roster pages and transactions are the roster authority. Persist source URL, retrieval timestamp, source hash, official position/status/team, stable Docked/provider identity and verification evidence. Retain raw source files privately for review. Name matching is only candidate generation: corroborate GSIS identity, team, jersey and a unique official profile. Review ambiguous aliases, recent trades, position changes and duplicate names independently.

Run the audit daily and after known transactions; do not activate a hosted scheduler until the data/storage/operational review is complete. Freshness expires after 72 hours. Expiry stops new issuance and reports stale evidence; it does not remove an owned card or erase the last verified roster observation. A failed/partial response is not an empty roster. `mergeRosterEvidence` retains prior verified observations when a team response is incomplete; newer verified observations update the existing identity, never create a new scarcity allocation. Cached HTML re-parsing retains the file's original acquisition time rather than pretending to fetch current data.

Local commands, in order (Node 22 and Edge):

```powershell
node scripts/nfl-roster-audit.mjs tmp/nfl-roster-audit
node scripts/nfl-roster-transactions.mjs
# Read-only snapshot requires the existing authorised server DB configuration.
node --conditions=react-server --import tsx scripts/nfl-roster-snapshot.ts
node scripts/nfl-roster-reconcile.mjs
# Review dated audit/identity conflicts and exact removal scope before cleanup.
node --import tsx scripts/nfl-test-cleanup-local.ts
node --import tsx scripts/nfl-roster-local-catalogue.ts
node scripts/nfl-roster-report.mjs
node --import tsx scripts/nfl-roster-browser.ts
```

The cleanup command has no hosted DB client or HTTP dependency and refuses Vercel execution. It uses the private snapshot and approved audit only. It will reject a different snapshot/preimage against an existing removal manifest; create a separately reviewed audit run rather than overwriting earlier evidence. SQL evidence imports must append observations, not update/delete them. The local audit evidence database is a development mirror, not the hosted append-only schema.

## Owned test assets and pre-generated packs

The owner's explicit 17 October instruction permits removal of verified ineligible test cards in an isolated environment. Only verified unsupported or positively corroborated released/retired identities absent from all current team lists qualify. Team-listed reserve records (including reserve/retired) and unresolved identities do not qualify for removal solely on status. No replacements or compensation are issued. Archive original ownership/history and permanently consumed serial allocations, preserve approved scarcity, and never recycle a removed serial.

Write a recoverable snapshot and exact removal/dependency manifest before the transaction. Use one atomic transition, compare pre/post hashes, verify unrelated records and wallet ledgers unchanged, check active orphan references, and retry idempotently. The present removal set contains no relational lineups/listings/trades/unopened-pack dependencies. The local runner stops if those appear in a later snapshot; such transitions need explicit domain-aware cancellation and recalculation with recorded rules, without inventing replacement players or modifying settled historical results.

Immutable allocation receipts may reference archived cards. Member replays show retained cards with a removal notice, while the original receipt remains in audit history. Pre-generated, unremoved cards that cease to qualify before opening cause a review error; keep the purchased entitlement and do not reroll, charge, refund or issue partially. Core weekly/legacy SQL paths have direct database mint guards, so a disallowed pick rolls the whole transaction back.

## Later production rollout — review only

1. Obtain separate approval for production; this task grants none. Refresh the 32-team evidence, reconcile current identity conflicts and review the missing-player/first-year release plan. Resolve Dallas transaction evidence when needed.
2. Take and verify a new encrypted/restricted backup plus immutable pre-execution manifest. Identify changes since the local snapshot, concurrent purchases/trades and any affected drafts/locked entries. Stop if the scope differs.
3. Test `20261017052556_official_nfl_roster_eligibility.sql` and `20261017054817_official_nfl_roster_pack_pools.sql` on a full isolated copy with the real runtime role and every legacy/weekly/product selector. Its official gate starts disabled. Import vetted append-only observations. The prepared starter and weekly SQL selectors now apply the same gate before choosing cards; the full-schema local Weekly Core test verifies insufficient-pool rollback and successful verified selection. Hosted acceptance and scheduled refresh remain pending.
4. Enable the evidence policy and SQL control together under an audited owner/MFA change, after a successful dry run and verified refresh job. Keep financial/trading restrictions unchanged. Do not mint identities or release new-player products merely by importing evidence.
5. **Do not load the cleaned JSON into production.** Existing aggregate/issuance guards intentionally reject removal of immutable instance projections. A reviewed migration must add a restricted archive and tombstone projection transition compatible with those guards. It must preserve permanent serial consumption and original allocation receipts, reconcile affected trading/pack/lineup dependencies atomically and have no ordinary-member invocation. That hosted removal migration is not part of the executed local cleanup.
6. Verify balances, accounts, ownership, scarcity, active references and original historical scores independently before reopening issuance. Record exact counts and hashes. Require separate review for any real-data correction.

Rollback: before activation, discard the new isolated store and restore a separate copy from the verified snapshot. After a future hosted activation, pause new issuance and restore the previous application policy through audited configuration; retain all evidence/audit rows. Never restore a stale whole-database snapshot over intervening legitimate transactions. Asset removal rollback must be a reviewed inverse archive transition that restores the original IDs/owners/serials without credit issuance; test it in isolation before authorising that migration.

Current outcome and all 32 dated sources: [audit handover](qa/nfl-roster-audit/README.md).
