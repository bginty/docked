# Scoring-based paid card pools

Owner-approved 11 October 2026: rank players **within each league** using their
**total Docked fantasy points from the previous completed season**, then freeze
the pool for the card edition. Association football remains EPL only; NFL is
ranked separately. Do not combine raw scores from different sports.

| Product | Player ranks | Player count | Card tier | Price |
| --- | --- | --- | --- | --- |
| Elite Single-Card Pack | 1–20 | 20 | ELITE | AUD99 |
| Premium Single-Card Pack | 21–170 | 150 | RARE | AUD49 |

Each purchase delivers exactly one randomly selected card from the disclosed
product pool. Premium is the RARE product label. Neither card tier nor purchase
price changes match-point scoring. The 20/150 counts describe distinct players,
**not approved numbers of card copies**, edition caps or permission to mint.

## Implemented preparation

`packRankingPolicy` and the product ranking bands are shared configuration.
`prepareScoringPackPools` builds proposed pools from a trusted league-season
scoring snapshot, including rules version, source snapshot ID and season bounds.
It uses integer hundredths of points, matching Docked's scoring representation.
Negative scores and genuine zero scores are valid; missing scores are not zero.

Incomplete/provisional totals or fewer than 170 ranked players produce
`DATA_REQUIRED`. Duplicate players, mixed leagues and invalid values are rejected.
Ties across rank 20/21 or 170/171 produce `BOUNDARY_TIE_REVIEW` without assigning
either pool. A player-ID sort only stabilises display inside a band, never chooses
a commercial tier at a tied boundary. No tie-break rule has been invented.

This is a **pure proposal builder**, not a hosted data importer, pool approval,
edition-freeze database workflow or sales activation. No actual player ranking has
been calculated in this change; test rankings are explicitly synthetic. The
existing sandbox random reservation operates on card units, not this proposal;
the future hosted bridge must validate the approved frozen pool before allocation.

## Source and edition controls required before sales

1. Reconcile a complete season of permitted match statistics using one recorded
   version of Docked scoring. Do not substitute another fantasy provider's points,
   current betting prices, current-season estimates or incomplete player subsets.
2. Record the league's previous completed season at the edition freeze date and
   exact included fixture IDs. NFL regular-season versus playoff inclusion remains
   an explicit scope decision before ranking; do not silently choose it. Separate
   current-club eligibility from historical season identity; retain stable IDs.
3. Resolve any actual cutoff tie under an approved, documented rule. If a ranked
   player is not eligible for the sale catalogue, hold/review; do not silently
   backfill the pool or promote the next player.
4. Approve immutable edition/pool records with dataset hash, rules version, season,
   player ranks/totals, source provenance, actor/time and finite card-unit supply.
   Validate paid-content rights, current player mappings and disclosed draw chances.
5. Corrections and later-season rankings create a new reviewed proposal/version.
   Never silently change a purchased card's tier, past scores, identity, serial,
   ownership history or lifetime issuance cap. An edition frozen for sale remains
   frozen; any necessary correction needs an explicit audited treatment.

The approved ranking rule resolves **how players qualify**. It does not establish
availability of full previous-season data, an approved sale edition/copy count,
commercial content permissions, or working hosted PayPal fulfilment. Live charges
remain disabled. See [PayPal integration status](PAYPAL_HOSTED_BUTTONS.md).

## Local verification

13 targeted ranking/commerce tests passed, plus typecheck, lint and production
web build. Cutoff, per-league, duplicate-ID, missing/provisional data and input
immutability checks used synthetic fixtures. No hosted deployment, actual-season
ranking, purchase, Android rebuild or physical-device check was performed.
