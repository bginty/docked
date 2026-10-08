# NFL Fantasy preparation — inactive

8 October 2026. The overnight instruction authorizes continued NFL preparation without changing live services. The separate queued NFL/live-beta prompt bodies were not available in the current task or repository. The related Docked chat confirms the request to add NFL before launch, but supplies no approved lineup/scoring/provider specification. No missing rules were invented as approved requirements.

## Implemented safely

`src/core/fantasy-nfl.ts` provides a pure offensive-stat scoring adapter and configurable lineup position matcher. Neither is connected to public API routes, existing SQL commands, a feed, card inventory, pack issuance or a deployed website. NFL is **not playable yet**. Existing football and Edge behavior is unchanged.

- Strict QB/RB/WR/TE input vocabulary and explicit stat fields; missing observations fail rather than silently becoming zero.
- Explicit versioned coefficients in hundredths of a point; integer arithmetic handles fractional points and negative yardage without floating-point rounding.
- Per-stat audit breakdown. No rarity, card price or ownership multiplier is accepted.
- Configured slots and a complete matching algorithm, including FLEX reassignment. No implicit team size, bench or automatic substitution.
- Duplicate cards/players, wrong sports, unsupported positions and malformed rules are rejected.
- Six unit scenarios cover arithmetic/categories, malformed/missing data, FLEX order independence, duplicates, and the existing APIs continuing to deny NFL mutation commands.

The authored example weights exist only inside tests. They are not an approved Docked season rule set. NFL's current [scoring documentation](https://support.nfl.com/hc/en-us/articles/35869730981140-Scoring) shows configurable statistical scoring and later statistical corrections; reading those rules does not grant rights to ingest, store or republish an NFL feed or player imagery.

## Integration still required

1. Recover the exact queued NFL requirements and reconcile sport scope, formation/team size, FLEX/SUPERFLEX, kicker/team-defense/IDP, fractional/negative scoring, bye/postponement handling, competition lock and correction/finalization policy. Current module supports offensive players only; no official NFL affiliation or complete standard scoring claim.
2. Select an authorized provider and approve its exact data rights, refresh limits and costs. Reuse existing source-rights/provenance gates. Existing Edge NFL fixture facts do not authorize fantasy statistics or an NFL pricing model. No live scrape, paid API or provider account was activated.
3. Add immutable sport/season rule versions, provider game/player identity mappings and source revision receipts in reviewed migrations. An amended stat snapshot must remain traceable and must not rewrite previously finalized results silently.
4. Extend server-authoritative card/edition/pack inventory and eligibility to NFL without changing permanent edition supply. Do not reinterpret existing football cards or silently change the approved 11-card Starter composition.
5. At lineup save AND lock/result time, enforce real ownership, sport/season/availability rules, active verified session and authoritative lock time. The pure matcher only proves position fit; it does not grant eligibility.
6. Integrate the approved scoring version into SQL settlement, immutable results and shared web/Android screens. Preserve zero performance multiplier for rarity, no automatic bench, disabled marketplace/payments and shared account/inventory.
7. Test scarcity, cross-sport rejection, concurrent pack/ownership operations, stat correction idempotency and rank ties against real PostgreSQL. Then run protected hosted desktop/mobile acceptance and native Android checks before enabling NFL.

No sport catalogue, card, reward, lineup or result was written to any cloud database during this preparation.

## Free-data candidate research (not approved or connected)

The maintained [nflverse-data repository](https://github.com/nflverse/nflverse-data) distributes statistical releases and its [package description](https://github.com/nflverse/nflverse-data/blob/main/DESCRIPTION) declares CC BY 4.0. The maintained [nflreadpy documentation](https://github.com/nflverse/nflreadpy) distinguishes most datasets from FTN data under CC BY-SA 4.0. This is a candidate for a no-purchase numerical-data review, not blanket approval of every file, upstream right, logo, photo or player likeness. Pin the exact dataset/schema/revision, record attribution and modification notices, verify update/correction behavior and complete the existing source-rights review before ingestion. No dataset was downloaded, registered as approved, scheduled or published in this run.
