# Real-player private-beta catalogue release — 23 October 2026

## Actual deployment

- Live: https://docked.com.au — application commit `a917637a0861f06491e76392ded8e6284efd34a3`.
- Vercel: `dpl_7b9rZLeVzYLrU3Y51aYzjwpG14Wz`, https://docked-production-92tyy3ial-briant-s-projects.vercel.app.
- Migration `20261022222531` and exact source dataset applied successfully to the existing private-beta Supabase project. Actual counts: NBA 517, AFL 545, NRL 337; 5,596 free non-permanent Core cards across the four existing tester identities. Thirty upcoming simulated test rounds received real-player eligibility; previous entries/results were not rewritten.
- Actual deployed dataset and attribution page match the reviewed source. All six real-roster pack products are available in the live configuration; a read-only configuration check simulated nine-card allocation in memory only. No Production purchases were performed for verification.
- Candidate and live endpoint checks: 17/17 passed in each environment, including registration closed and unauthenticated access denied to protected gameplay, wallet, marketplace and owner APIs.
- Protected-record hashes and wallet ledger comparison passed inside the committed import. No credit adjustment or permanent issuance occurred.
- Owner, Barry and Luke: enabled, confirmed and admitted in the database; normal MFA still applies where required. Brenton: enabled beta access and inventory prepared, but email unconfirmed and admission correctly blocked.
- **Authenticated hosted UI acceptance remains unverified.** No signed-in browser tab was available, and creating a live IAB tab failed to attach. No credentials were guessed and no member session was impersonated. The mobile/desktop screenshots in this directory are isolated local acceptance evidence.

To review: refresh Docked, select the sport, open CARDS, then use Buy packs or Build team. Existing fictional teams are retained until the tester deliberately changes them; earlier fictional cards are hidden by default behind an explicit checkbox.

## Delivered scope

The existing Docked application, shared accounts, wallet and card renderer now support a dated, source-verified real-player beta catalogue: **NBA 517 players / 30 teams; AFL 545 / 18; NRL 337 / 17**. This is an accepted subset, not a claim that every professional player or current contract has been independently verified. Unsupported positions, conflicting teams and unresolved identities are quarantined in `roster-review.json`.

Wikipedia roster/profile agreement and stable Wikidata IDs replace invented names for new beta browsing, packs and lineup selection. Source links, revisions, retrieval timestamps and payload hashes accompany all accepted records. The adapted dataset is published under CC BY-SA 4.0 at `/roster-sources`; Wikidata identifiers are CC0. No photographs, logos, biographies or game statistics were imported. This route does not establish commercial player-card or live-data rights.

Each existing authorised tester receives free, isolated Core inventory for the accepted players. Existing saved fictional teams, purchased cards, receipts and historical records are retained. New Auto Select and player pickers prefer real roster inventory. Search, position and rarity filters, pagination and source links are available through CARDS. NBA uses basketball jerseys, AFL guernseys and NRL rugby jerseys with existing generic colour palettes; no invented shirt numbers.

The existing test-credit pack engine supplies Standard and Premium nine-card real-roster packs at the existing 700 / 5,000 credit prices and existing rarity probabilities. Paid test packs exclude Core. Allocations, serials, replay protection, purchase history, reveals and scoped ownership use existing services. Limited beta serials are **not permanent supply**. Permanent issuance and real statistics remain disabled. Existing test marketplace settlement and 5% seller fee, capped at 2,000 credits, are preserved.

## Root cause

The overnight release deliberately registered only synthetic fixture identities. Player/pack boundaries correctly rejected non-registered real identities, and pack allocation continued to use the fictional pool. The fix introduces an explicitly registered, source-backed non-permanent inventory class within those existing boundaries. It does not bypass them or place beta identities in the permanent player registry.

## Evidence and limits

- 591 platform tests and 209 isolated database tests passed, including NFL regression, real-roster purchase/replay, ownership, lineup, offer and privacy scenarios.
- Four dedicated roster/identity/capped-and-open lineup tests passed; all accepted teams resolve to the original jersey palettes.
- Actual application components and isolated SQL passed mobile 412px and desktop 1440px CARDS/PLAY journeys for all three sports.
- Real-roster pack browser journeys passed 360, 412, 1024 and 1440px for all three sports, including lost-response/retry and duplicate-click protection; zero serious accessibility findings in those pack checks.
- `verification.json`, per-sport screenshots and browser receipts distinguish isolated testing from hosted member acceptance.
- No authenticated hosted member session was available. Operator database verification and anonymous endpoint checks do not constitute signed-in UI acceptance. Brenton's existing account confirmation/admission requirements are preserved.
- The heuristic secret scanner reports eight unchanged pre-existing test-fixture findings; see `secret-review.json`. Canary build results are recorded separately.

## Production sequence and recovery

1. Read-only application data/function recovery snapshot, read back and hashed. This is not a full disaster-recovery rehearsal or Auth backup.
2. Apply migration and complete import inside a transaction that deliberately rolls back. Compare protected NFL, permanent ownership, transactions, results and ledger records.
3. Commit and stage the compatible application on the existing Vercel Production project without moving the domain. Check the candidate, then promote.
4. Only after compatible code is live, apply `20261022222531_verified_roster_beta_inventory.sql` and the exact reviewed dataset using `scripts/roster-beta-release.mts apply`. Registration, product configuration, free isolated Core inventory, future simulated-fixture eligibility and audit entry commit together. No wallet adjustment, permanent issuance, historical result or original player mutation.
5. Verify actual import counts, existing access gates, unchanged protected records and live endpoint security.

**After import, do not promote the old application blindly:** it cannot parse the new pack product IDs. Suspend affected private-sport/test-commerce gates and retain the compatible parser/additive schema while rolling forward or preparing a compatible rollback build. Never delete purchases or ownership history to make old code work.

Re-running the import keeps stable player/card identities and does not issue duplicate Core inventory. Subsequent roster revisions require explicit review rather than silently replacing historical identity records.

## Remaining external decisions

Commercial/permanent player-card issuance and live game statistics remain unapproved. Current contracts, match availability and future transfers require ongoing authoritative verification before permanent issuance. NRL hooker-only players remain excluded until the provisional format has an approved hooker eligibility rule. Missing positions are never guessed. The snapshot does not turn synthetic test fixtures into real results.

Deployment and actual import receipts are in `release/`. All successful source imports are separate from statistical-feed activation; NFL ingestion is unchanged.
