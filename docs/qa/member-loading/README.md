# Pack availability and member loading repair

## Confirmed defects

The request-time catalogue refresher skipped synthetic fixtures, but real roster beta records are deliberately marked `synthetic: false`. It therefore looked up all 1,399 real NBA/AFL/NRL records in the NFL status feed. None matched; their projected status became unknown. Both pack availability and purchase authorisation used this path. All six new products consequently had zero eligible players despite the stored roster being valid.

The same wallet endpoint returned a full catalogue, per-player supply and owner audit report for every balance-header refresh. The owner response measured 4,471,243 bytes. Pack loading made a second request for the same data. Read requests also held the global settlement advisory lock throughout catalogue/visibility queries, serialising otherwise independent page reads.

## Changes

- Keep registered real beta roster observations intact during NFL refresh. Validate provenance before taking that path; malformed records still fail closed. NFL observations and freshness checks remain in place.
- Use a small balance/profile projection from the same authenticated wallet service, without refreshing unrelated catalogue observations.
- Use a compact pack projection for initial reads, refreshes and post-purchase responses. Keep receipts, historical fees, prices, balances and purchase idempotency. Owner reporting remains available on the wallet page.
- Remove the unused all-player supply catalogue from ordinary responses.
- Read the ledger and access projections in a read-only, repeatable-read snapshot without the settlement advisory lock. Purchase/transfer mutations retain the existing exclusive lock and database guards.
- Cancel abandoned sport-shop requests. Report temporary service failures as retryable service errors instead of incorrectly calling them admission failures.

## Verification

`verification.json` records the local test results and browser screenshot paths. The browser harness now exercises the real request-time catalogue refresher before displaying or purchasing packs. Its transport and purchase data remain isolated fixtures.

- 594 platform tests passed, including new refresh, malformed-evidence, compact-projection and purchase-replay regressions.
- 209 database tests passed, including registered beta identity validation through atomic issuance, ownership, privacy and NFL regression.
- NFL, NBA, AFL and NRL pack journeys passed at 360, 412, 1024 and 1440 pixels, including purchase/reveal, rejected purchases, lost-response recovery and sport switching. No serious accessibility findings in those checks.
- Typecheck, lint, clean production build and compiled client-secret canary scan passed.
- Read-only Production diagnosis retained all 1,399 active real roster players and made all six beta products available. Existing NFL products retained 402 eligible players.
- Actual Production runtime database credentials accepted repeatable-read/read-only transactions. Unauthenticated sport capability remained denied.

Measured owner data response sizes: shared header **10,151 bytes**, pack shop **314,090 bytes**, wallet including owner reports **2,409,125 bytes**. These are serialized data measurements, not authenticated page-load timing claims. Local diagnostic timings varied under concurrent test load; the final isolated measurement is in `after.json`.

No signed-in Docked browser was exposed by the connected browser during this repair. Production HTTP checks verify deployment identity and unauthorised denial; they must not be described as authenticated member purchase acceptance. No hosted purchases, account changes, ledger adjustments or card transfers were made for verification.

## Release and rollback

No database migrations, feature activations or financial changes are required. Use `scripts/member-loading-release.mjs` with the reviewed full deployed baseline commit. Stage without moving the live domain, run `scripts/member-loading-http.mjs`, then promote and run its `live` checks. The release keeps the existing private-beta flags and closed registration.

Rollback is promotion of the captured compatible real-roster baseline deployment. It needs no database rollback or inventory deletion. See `release/rollback.json` after preparation.

Reproduce the safe operational measurements with `scripts/member-loading-diagnostic.mts`; it uses the existing TLS operator/runtime configuration, read-only transactions, and writes only aggregate counts and timings to the local evidence directory.
