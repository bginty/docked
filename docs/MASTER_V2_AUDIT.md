# Master V2 local quality pass

## Prioritised defects

1. **P0 — modal ownership:** each FantasySheet independently saved/restored body overflow. Closing an earlier sheet while a later sheet remained open could restore `hidden` permanently. Independent popstate listeners also dismissed every sheet, and native Back selected the first rather than top dialog. Replaced with ordered, idempotent modal leases and one Back handler. Original Samsung Social recording is not available in this turn; this is a reproducible lifecycle defect, not a claim of an exact device reproduction.
2. **P1 — Social attachment scrolling:** the inline inventory picker imposed a capped nested scroll area inside the feed. Moved selection into a single scrolling sheet with search, explicit Done, selected-card preview and review before publication. Retain server idempotency keys on errors. Bound confirmation requests so network failure does not indefinitely disable the form.
3. **P1 — divergent card faces:** lineup, selectors and details separately rendered jerseys/name/rarity. Consolidating into CollectibleFace, wrapped by FantasyCardArtwork for standalone cards. Context actions/salaries stay outside the face. Existing shared rarity configuration and jersey number provenance remain authoritative.
4. **P1 — Market selector leakage:** `.market-grid article` styled both listing wrappers and nested collectible articles. Restrict to direct children; separate listing footer. Replace expanded filter form with compact search/sort and a modal filter panel; preserve URL-backed filtering.
5. **P2 — name/location/serial hierarchy:** one city projection and serial formatter. Unknown or regional team identities without unambiguous city metadata use a neutral fallback. Canonical records and historical snapshots are untouched.
6. **P2 — profile/options:** retain existing premium tabs and secure avatar editor; refine recognisable moderation control and test actual synthetic uploads, replacement, removal and persistence.

## Boundaries

Local development and isolated synthetic QA only. No live inventory, credits, identity documents, production database or deployed feature flags are changed. Financial redemption, document collection and unauthorised trading stay disabled. No physical Samsung S24 acceptance is claimed.

## Evidence

New runs and screenshots go to `docs/qa/master-v2`. Earlier QA artifacts are not evidence of this pass. Final verification results and remaining gaps will be recorded after rendered review.
