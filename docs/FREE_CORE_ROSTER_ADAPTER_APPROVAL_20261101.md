# Free-Core verified-roster adapter — Production approval package

Prepared and owner-approved 1 November 2026. **Applied to Production at 09:55:43 UTC.** Existing public registration, payment, prize and NBA gates stay closed.

## Established gap

The approved `20261031123611_free_core_gameplay_eligibility.sql` migration is applied, but its roster table references the legacy `beta_fantasy.players` registry. Current verified AFL/NRL roster identities reside in `credits_sandbox.nba_fixture_players` (a shared legacy name, not NBA activation). There are no AFL/NRL player identities in the legacy table. The free-Core roster is empty and all three programmes remain disabled. Copying identities into the old registry would require invented legacy player attributes and duplicate identity maintenance.

## Exact proposed migration

`20261101090955_free_core_verified_roster_adapter.sql` adds an empty private RLS table referencing the existing verified roster registry and extends the existing gameplay-only projection. It retains the original NFL lookup. It creates no cards, serials, wallets, entries or competition rules and enables no programme.

Returned Core choices are explicitly unowned, untradeable, numberless when unverified, and restricted to the authenticated member and opted-in, enabled, unscored, unlocked competition. Registry evidence, source hash, expiry, active status and positions must agree. Historical snapshots and existing owned-card validation are unchanged. The function and table are not callable/readable by anonymous, authenticated, service or application roles directly; existing guarded server projections use them.

## Verification

- Four migration/eligibility tests passed: existing free-Core tests plus the verified-registry adapter for AFL and NRL.
- Independent PostgreSQL 17.10 runs passed AFL and NRL, including valid 22/13-player submissions with zero collectible ownership, historical snapshot retention, invalid eligibility, wrong account, expiry and RLS denials.
- Replaying this migration in the fixture passed without double wrapping.
- The initial combined native run failed on the second fixture because the disposable cluster retained its roles. Separate fresh-cluster NRL run passed; this was a fixture-isolation failure, not a passed combined run.
- Typecheck and targeted lint passed.

## Application and recovery

Applied once to `pojoymtniryarxxunyvz` through the existing scoped migration runner, using the exact approved history version. Preflight confirmed history absence. The apply transaction backed up 14 tables and four function definitions with AES-256-GCM, verified decrypted readback, and compared 15 protected table fingerprints before/after (including the append-only history). The original NFL/legacy function body was preserved exactly. Post-apply history/source inspection matched; no duplicate logical migration was applied. Readback confirmed zero adapter rows, disabled programmes and denied direct application-role table/function access.

Receipts: `qa/final-play-acceptance-20261101/roster-adapter/migrations-applied.json` and `migrations-inspected.json`. SQL SHA-256: `6bf8215ee146cd167e5cb921aa05d7155633cba5d0fc09aaa0714df2c37d5af8`. The encrypted backup is local/private; it is a scoped recovery backup, not a claim of a full managed disaster-recovery backup.

Rollback is to keep programmes disabled and restore the original function body from `free_core_inventory_before_roster_beta`, retaining the empty adapter and migration/audit record. Do not delete records or revert customer snapshots. Because this change seeds nothing and has no activation, it has no immediate customer inventory effect.

## Separate configuration still needed

Approval of this additive migration does not itself make reviewer gameplay ready. A reviewed eligibility snapshot with source hashes/expiry and a saved rule opt-in are required for each suitable no-prize test round. Existing AFL/NRL future Round 3 records must be inspected for entries and immutable-rule constraints before any transition. NFL presently has only closed Week 7, so a separately identified, explicitly labelled future/practice no-prize competition is required; do not invent official fixtures or rewrite Week 7. Public registration and broad activation remain separate decisions.

No full-access Play Console declaration should be made before the nominated ordinary reviewer completes the actual free-Core lineup and entry journey in all three sports.
