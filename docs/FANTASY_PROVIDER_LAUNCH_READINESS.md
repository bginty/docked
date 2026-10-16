# Fantasy sports data: commercial-launch readiness

Reviewed 16 October 2026. This is the current NFL/EPL evaluation and integration checklist. The older `PROVIDER_READINESS.md` and `PROVIDER_COMPARISON.md` concern the retired odds product and do not authorise any current integration. No new provider connection, licence, subscription, polling or production import was enabled during this review.

## Architecture retained and strengthened

The existing pipeline already separates transport, provider-specific normalisation, canonical scoring and publication:

1. `sports-feed-client.ts`: fixed vendor hosts and paths; header-only credentials; explicit expiring free-beta use/storage approval; quota reservation before each attempted request; bounded body and timeout; no redirects or provider error-body logging.
2. `sports-feed-worker.ts` and `sports-feed-store.ts`: leased jobs, retry ceiling/backoff, private raw revisions with hashes, source evidence and retention timestamps. Network retries consume quota. Expired payloads can be purged while immutable hashes/provenance remain.
3. `sports-feed-adapters.ts`: provider field mapping into the existing canonical snapshot. Fixture and player identities are explicit, exact and one-to-one. Unknown/missing scoring evidence stays pending. No names, provider fantasy totals or guessed zeroes become scoring authority.
4. `sports-feed-reconcile.ts`: bind the retained raw resource and frozen fixture mapping, validate approval again, serialize revisions, make identical replay a no-op, and send normalised statistics into the existing deterministic scoring engine.
5. `scoring-engine.ts`, `scoring-v1.ts` and existing entry snapshots: ruleset/version isolation, roster locks, correction review, auditable finalisation and historical replay. Provider changes do not change coefficients or move historical entries to current ownership.

Safe fixes in this review: preserve free-beta rights rather than manufacturing `commercialFantasy: true`; enforce bijective mappings at both adapter boundaries; reject US Eastern spring-gap timestamps as well as autumn ambiguity; block credential echoes after JSON unescaping; cap newly retained payload expiry at the earlier of the storage window and approval expiry. Existing stored records were not rewritten.

The current commercial-provider adapters deliberately cannot finalise complete scores until their known field gaps are resolved. Their reconciliation checks the immutable canonical fixture/player set; the caller-supplied vendor-ID mapping still needs durable versioned retention before commercial activation. The existing NFL post-game pipeline already persists immutable provider mapping hashes and is the implementation pattern to reuse. Its historic beta evidence is not a commercial licence for another provider or use case.

## Provider comparison worksheet

Complete a separate signed/dated worksheet for each actual quote. `Unverified` means a supplier response or successful authorised contract test is still needed, not that the capability is absent. Do not copy older quoted prices into a purchase decision.

| Evaluation item                | SportsDataIO candidate                                                                              | Sportmonks candidate                                                                              | Other licensed candidate           |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------- |
| NFL/current season coverage    | Existing NFL adapter scaffold; exact plan unverified                                                | No NFL adapter in this repository                                                                 | Unverified                         |
| EPL/current season coverage    | No EPL adapter in this repository                                                                   | Existing EPL adapter scaffold; exact league/plan unverified                                       | Unverified                         |
| Player, team and fixture IDs   | Test stable IDs, transfers, aliases, historic assignment and deleted/merged IDs                     | Same                                                                                              | Same                               |
| Required player statistics     | Confirm every NFL field; offensive fumble-recovery TD attribution remains unresolved in adapter     | Exact regulation seconds, on-pitch event boundaries and Docked assist semantics remain unresolved | Supply field-by-field mapping      |
| Live/final and corrections     | Request final-only and live entitlements separately; prove final/reopened/corrected lifecycle       | Same                                                                                              | Same                               |
| Historical coverage            | Confirm seasons, revisions, retention after contract ends                                           | Same                                                                                              | Same                               |
| Reliability and update cadence | Quote SLA, outage notice, correction windows, quotas and overage behaviour                          | Same                                                                                              | Same                               |
| Commercial fantasy use         | Written Docked-specific grant pending                                                               | Written Docked-specific grant pending                                                             | Written grant pending              |
| Collectible/market/social use  | Separately confirm names, stats, derived scores and permitted redistribution; logos/photos excluded | Same                                                                                              | Same                               |
| Raw/derived storage rights     | Written retention, archive/replay, backups and termination terms pending                            | Same                                                                                              | Same                               |
| Trial                          | Confirm allowed scope, duration, scrambled data, auto-renewal and cancellation                      | Same                                                                                              | Same                               |
| Estimated cost                 | Quote required; include currency, tax, rate caps and overages                                       | Quote required                                                                                    | Quote required                     |
| Integration effort             | Scaffold exists; field evidence, mappings, replay and outage acceptance remain                      | Scaffold exists; field evidence, mappings, replay and outage acceptance remain                    | Adapter + full acceptance required |

Current official starting points checked for this audit: [SportsDataIO NFL API](https://sportsdata.io/developers/api-documentation/nfl), [SportsDataIO rights/licensing](https://sportsdata.io/help/data-rights-and-licensing-questions), [Sportmonks v3 documentation](https://docs.sportmonks.com/v3). API documentation is not permission for Docked's proposed commercial use. No prices, permissions, trial access or supplier commitments were inferred.

## Controlled trial and integration checklist

- [ ] Owner approves the exact supplier, test scope and any cost; commercial use separately documented. Do not activate a paid auto-renewing trial by default.
- [ ] Record rights evidence, scope, effective/expiry timestamps, NFL/EPL season and competition, raw/derived retention, redistribution, attribution and post-termination replay permission. Keep beta and commercial grants separate.
- [ ] Store credentials only in the server worker secret store. Never use `NEXT_PUBLIC_*`, APK assets, query strings, analytics or screenshots. Verify rotation and revocation procedures without printing the credential.
- [ ] Freeze provider/entity mappings by stable IDs and sport/competition/season. Team assignments and fixture changes require explicit reviewed revisions; no fuzzy player-name joins.
- [ ] Use synthetic fixtures first (`tests/platform/provider-readiness.test.ts`, `free-beta-data.test.ts`). Then replay a bounded authorised sample, with expected hand-checked per-statistic scores and evidence hashes.
- [ ] Validate null/absent data, DNP/bye, cancelled/postponed/rescheduled games, duplicate rows, negative/fractional values, incomplete final games, DST, corrections and missing player coverage. Missing must remain pending, never a manufactured zero.
- [ ] Reproduce the same results from immutable raw revision + mapping version + ruleset + locked entry snapshots; repeat imports must not add another correction.
- [ ] Test network failure, timeouts, quota exhaustion, concurrent claims, expired leases, retries and expired rights in an isolated database. Confirm no half-written journal or changed member entry.
- [ ] Agree processing cadence, daily quota budget, operational owner, exception threshold and a finalisation/review policy. Injury warnings require independently licensed and sufficiently fresh evidence; they remain unavailable otherwise.
- [ ] Schedule payload retention/purge and test that expired bodies disappear while lawful audit evidence remains. Verify backup retention separately; a purge job alone does not establish deletion from backups.
- [ ] Approve production adapter/version and exact environment binding before deployment/activation. Keep the current scoring rules; gaps require better evidence, not relaxed calculations.

## Launch gates still open

Commercial rights and supplier credentials/quotes have not been supplied for this work. Vendor field gaps remain intentionally pending. Real account/trial acceptance, production operational monitoring and a complete licensed restore/replay drill remain required. No new injury feed, live scoring, sports, or provider-specific scoring rules were introduced.
