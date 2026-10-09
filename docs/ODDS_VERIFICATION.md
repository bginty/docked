> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Community standard-price verification

Phase 3, 3 October 2026. **ODDS_PROVIDER_STATUS=NOT_CONFIGURED** remains the honest local state. No API credentials, provider subscriptions or real odds were fabricated or purchased. The existing The Odds API integration is a candidate provider; its ordinary h2h response alone does not establish that a price is universally standard and non-promotional.

## Accepted evidence

Community verification consumes only an immutable current `private.odds_snapshots` record received through Docked's licensed server ingestion. Retrospective/demo snapshots cannot be promoted. Mapping requires exact provider event ID, canonical event, verified start time, full market period/overtime/draw/line/settlement rules, complete outcome vector and eligible bookmaker. The user supplies a selection from this evidence, never its price. Both source and receipt age are checked against the community rule, and provider outage or missing rights closes submission.

Classification values are `STANDARD_VERIFIED`, `PROMOTIONAL_EXCLUDED`, `UNVERIFIED`, `STALE`, `MARKET_MISMATCH`, `UNSUPPORTED`, `POST_CUTOFF`, and `UNKNOWN_REVIEW`. A missing classification is unknown, never standard by default. Enhanced/boosted, personalized, token, VIP, introductory and capped promotional offers are social-only and excluded from competitive records. An ordinary bookmaker/account limit does not itself make a normal quote promotional. This benchmark records an observed price, not a guarantee that any individual can place a wager.

## Trusted adapter contract

`ProviderQuote` in `src/providers/contracts.ts` extends the existing official `Quote` with optional `communityMetadata`:

```ts
{
  sourceKind: "current_provider",
  receivedByDocked: true,
  providerEventId: string,
  observedStartAt: string, // ISO timestamp with offset, equal to canonical start
  priceClass: "STANDARD_VERIFIED" | "PROMOTIONAL_EXCLUDED" | "UNKNOWN_REVIEW",
  classificationVersion: string,
  classificationEvidence: string, // retained licensed source evidence/reference
  promotionFlags: string[]
}
```

Only a reviewed server adapter may produce this metadata from evidence covered by the provider contract. It must never copy member assertions or set standard simply because a market is called `h2h`. The current The Odds API adapter intentionally supplies none, so its quotes remain unavailable for community submission until standard-price evidence is established.

`ingestSport` persists the optional metadata with the immutable original quote. After the official ingestion transaction commits, it calls `registerCommunityQuoteEvidence` only for quotes containing the metadata. The database derives classification from that retained payload, overriding caller fields; nonempty promotion flags force promotional exclusion. Registration failure is isolated from official ingestion and recorded in the private audit when available. Official pricing configuration/evaluation is unchanged.

The source-health row must hold a current reviewed `rights_reference` matching the quote provenance plus explicit capabilities `display: true`, `retention: true`, and `community_standard_prices: true`. Merely adding an API key does not supply these permissions. Result ingestion is independently authorized and cannot be inferred from odds rights.

## Activation dependencies and operating review

1. Supply the dedicated Docked preview database/auth credentials documented in PREVIEW_SUPABASE; do not use another project.
2. Supply a licensed odds provider key and documented rights for community display, retention, standard-price classification and intended territories. Existing required odds variables remain `ODDS_PROVIDER_STATUS`, `ODDS_API_KEY`, `ODDS_RIGHTS_REFERENCE`, `ODDS_MONTHLY_CREDIT_LIMIT`, `ODDS_REGIONS`, and `ODDS_POLLING_ENABLED`; none bypasses source capability or jurisdiction checks.
3. Approve exact event/bookmaker mappings and implement a reviewed adapter mapping the provider's real classification evidence into the above optional contract. Preserve quota protection. Do not edit old snapshot payloads; obtain a new current observation.
4. Approve country/state features/operators and bookmaker effective dates; retain feature flag `community_edges=false` until verification and legal review pass. A quote review screen alone does not enable the flag.
5. Supply an independently licensed ResultsProvider and append its reviewed approval/version in `community_result_sources`; review/renew/revoke through authenticated MFA staff operations. Connect the ready provider to `reconcileCommunityResults`; until then outcomes remain PENDING. No unauthenticated import or self-settlement endpoint exists.
6. Run real preview concurrency, request retry, source outage, price movement and correction tests using authorized preview data before approval. No production DNS/deployment change is included.

`/admin/community/verification` and `/admin/community/promotions` read the private evidence/review audit through MFA staff APIs. No review button can turn a screenshot or member-entered promotional quote into immutable standard-price evidence.
