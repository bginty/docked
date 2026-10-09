> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Community Edge integrity

Phase 3 implementation, 3 October 2026. Community services are not activated on a hosted environment. There are no genuine community performance records in this build.

## Separate canonical record

Official Docked publications keep their existing pricing engine, decision records, publication ledger and validation lifecycle. A community Edge is a member's opinion backed by a verified observed standard price; it is not an assertion that Docked's model found positive EV. `private.community_edges` stores its own durable social author ID, event and market mapping, settlement rules, provider observation/evidence ID, source/snapshot/receipt times, bookmaker, selection, decimal odds, region approval, verification rule and server submission time. The standard benchmark is exactly **1.00 unit**, independent of any real wager or stake.

The installed rule is `community-standard-v1`: full-game EPL/La Liga regulation 1X2 and NBA moneyline including overtime; supported outcomes must match both participants (plus Draw for football). Maximum source/receipt age is 180 seconds. Submission closes strictly 600 seconds before the current verified commencement. Valid decimal odds exceed 1 and are at most 1000. One canonical Edge per member per event prevents duplicate or opposing records being used to inflate the sample. These are versioned community rules, separate from the official strategy's odds/EV filters.

## Confirmation transaction

`GET /api/community-edges?view=options` lists only eligible retained current provider observations. `POST` review accepts `snapshotId` and `selection`; submission additionally accepts the returned review token, a new UUID idempotency key, optional social reasoning and `confirmedPermanent: true`. It never accepts user-entered odds, screenshots, stake or a result. Input objects are strict; authentication, rate limits and bounded streamed request bodies precede processing.

Submission may attach up to four unique approved social-media IDs owned by that member. The transaction rechecks ownership, approval and retained content before linking them to the social projection. These images are commentary only: a screenshot never supplies or overrides the quoted price, event mapping, verification evidence or settlement.

The permanent acknowledgement is shown before submission: “PERMANENT RECORD — Once submitted, this Edge becomes part of your Docked performance record and cannot be deleted or edited.”

The server transaction locks the author and market, rereads the latest provider observation and checks the token and price. A changed observation returns `PRICE_MOVED`/409 with the previous and new observed price, requiring a fresh review and confirmation. Repeating an identical successful request returns the original Edge; reusing its UUID with a different request is a conflict. Database uniqueness also prevents concurrent duplicate records.

The insertion trigger independently locks and validates the current account/session, current jurisdiction, bookmaker, event, market, quote, provider rights, feature pause and timestamps. Crucially it reads `clock_timestamp()` **after** waiting for its locks, so contention cannot preserve an earlier cutoff/freshness decision. New snapshot ingestion and confirmation both acquire the market row lock. The trigger ignores caller backdating and stamps the actual insertion time. Social projection, initial status, audit and a durable in-app notification fanout job are in the same transaction; a bounded worker applies recipient preferences before delivery. No external email or push is sent.

Current regional approval must explicitly include `community_edges` and the bookmaker. Missing/revoked policies deny the API and database path. The current age attestation proves only 18+, so any policy requiring an older age is denied until stronger evidence is implemented.

## Settlement and corrections

`reconcileCommunityResults(ResultsProvider, eventId, correctionReason?)` is the internal authorized-results integration entry point. The provider must be ready/authorized, return the exact retained event/market contract, identify its source event/revision and supply observed final outcomes. Initial result-source approval must already exist in the database. No public/member API accepts a winner or scores. Missing results, cancelled/postponed/rescheduled/abandoned events remain pending; void requires explicit authorized reason and settlement basis. NBA ties are disputed. Final scores must be complete finite non-negative integers. Database code derives WON/LOST/VOID/DISPUTED/MANUAL_REVIEW; callers cannot choose an inconsistent result.

Results-source approvals are append-only versions. A latest `approved=false` review revokes future settlement immediately; expiry also denies. Settlement and source review share a provider advisory transaction lock. Each settlement records the exact source approval used, preserving prior rights history without allowing silent renewal or rewriting.

Changed results require an administrator with verified MFA, an active session, a reason and `supersedesRevision` naming the previous retained result. The append-only chain creates a linked correction with old/new results, reason, actor, source/revision reference and time. The member detail page shows these changes; its actor is a stable reviewer pseudonym rather than a private authentication identifier. Full actor IDs remain in the staff audit. Admin integrity reviews are separate append-only status events; members cannot clear their own review. Review status removes ranking qualification, **never the losing record**.

## Privacy and deletion

Commentary can be removed or moderated. The structured Edge and settlement cannot be edited/deleted by ordinary, moderator or administrator paths. Blocking, profile privacy, suspension and account deletion cannot remove records from the canonical list, detail or performance input. Regional access still gates the viewer. Restricted identity is represented as “Community member” with a durable pseudonym and `interactionsAllowed=false`; social discussion/following views may hide blocked content independently. Account erasure clears personal fields and the auth/profile link while retaining the minimal durable ledger identity and audit evidence. Retention duration and legal basis need jurisdiction-specific legal approval before activation.

## Verification and limits

Disposable PGlite PostgreSQL tests cover RLS/direct API denial, unknown/promotional/historical evidence, inflation, cross-user submission, duplicate identity, cutoff/staleness, superseding quotes, 21+ policies, latest-policy revocation, immutable ledger/status/settlements, result authorization, nonfinite scores, correction chains, source revocation, social privacy and account erasure. Pure tests independently exercise verification and ranking arithmetic. PostgreSQL row-lock concurrency across real simultaneous sessions still requires the dedicated preview database; PGlite validates transactional constraints but is not a distributed load/concurrency test. The SQL operator can always disable triggers; owner credentials are operational secrets, not an application authorization path.
