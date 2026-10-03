# Phase 4 database and server reference review

Prepared 3 October 2026. Implementation readiness is separate from methodology validation. The market-reference methodology remains **UNVALIDATED**, default cohorts remain empty, and no live/paper strategy was approved or enabled by this change.

## Additive storage and compatibility

Migration `20261003030722_phase4_market_reference.sql` adds immutable, private, RLS-protected reference evidence and methodology registrations, append-only publication movements, and private erasable personal notes. All existing publications and community records retain `legacy_bookmaker_v1`, their original odds, rules and version. The original settlement and performance arithmetic continues to use the immutable `odds` field. New official `odds` are copied from the publication reference; new community `odds` are copied from the submission reference.

New official strategy configurations use `market-reference-independent-cohorts` with a new `market-reference-edge-*` version. The original lifecycle, frozen commit/configuration, research, region, role and release switches remain enforced. A source/configuration change under an already retained methodology version is rejected; use a new version and repeat required validation.

## Server and database enforcement

The API accepts market and selection identifiers plus a confirmation token bound to actor, configuration, price and exact source IDs. It rejects competitive price, bookmaker, snapshot, units, verification and reference overrides. Optional personal bookmaker/price/promotion claims enter a separate social-notes table and never enter pricing, settlement, rankings or qualification.

The database independently reconstructs the complete eligible source cohorts, deterministic independent-operator representatives, lower median, outlier exclusion, spread, normalized probability, all-outcome disagreement and current source approvals. It checks supported market rules, explicit bookmaker source type, complete ordinary prices, source timestamps, provider health, current licensing/classification and region eligibility. It reconstructs canonical configuration, rules and retained-source evidence hashes. A non-null probability without a sufficient independent pricing cohort is rejected. A current reference is rechecked when consumed for submission, publication or an active movement.

Source/market/provider/ownership and methodology locks precede a refreshed database clock, with a final cutoff/freshness check before reference insertion. Legacy evidence is never retroactively turned into reference evidence. Closing probabilities remain separate diagnostic observations, with the existing pre-start diagnostic window; settlement never reads them as the benchmark price.

Current official EV uses the captured publication probability and current reference price. Current pricing-cohort probability can supply closing diagnostics. A below-minimum, suspended or expired publication cannot become active again under version 1; a recovered price is suspended, with a retained movement and no additional bet. Expired records may transition to settled only with verified settlement evidence.

Repeated reads with the same source cohort, price and status do not append redundant movement/reference rows. Changes and first failures are retained. Public/member projections omit provider payloads and expose named, versioned reference summaries alongside the immutable benchmark.

## Privacy and authority

All new tables have RLS and no anonymous/authenticated table grants. New helpers are security invokers with PUBLIC/anonymous/member execution revoked. Optional personal claims are included in the owner's export, hidden when social identity is inaccessible, and erased before account pseudonymization. The permanent reference and accounting ledger survives without these claims.

## Verification

`tests/database/market-reference.test.ts` covers private access, lower-median override denial, provider outage, cross-user submission denial, personal promotional accounting separation, legacy compatibility, immutable publication/reference, non-reactivation, evidence hashes, methodology version immutability, fabricated source-less probabilities, missing required market-rule scalars and personal-note erasure. `tests/platform/community-reference-input.test.ts` rejects client accounting overrides. Core/provider/reference and Top Docked parity tests are maintained separately. See the final Phase 4 test receipt for complete suite totals.

Hosted helper: `scripts/hosted-preview/market-reference-rollback.ts`, called through the exact-project operator wrapper `run-market-reference-rollback.ts`. It requires genuine existing reserved QA Auth sessions and genuine administrator MFA, makes no Auth rows, disables no triggers, uses nested savepoints for denied writes, waits roughly 11 minutes for the actual database event clock, verifies a positive settlement and Top Docked benchmark arithmetic, and throws a completion sentinel to roll the entire transaction back. The wrapper verifies sporting row counts before/after and writes only sanitized evidence. No hosted run is claimed by this document; use its resulting receipt.

## Recovery

Apply only to the independently verified Docked preview, inside the migration transaction after preserving the target's reviewed data/catalog preimage. No destructive down migration is provided: use transactional rollback on application failure, or a reviewed forward repair for an already applied migration. Root's targeted preview preimage is an operational recovery aid, not proof of a complete Supabase disaster-recovery restore. Never replay these fixtures into production.
