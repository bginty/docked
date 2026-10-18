# Private beta marketplace activation readiness

## Pause diagnosis

The production deployment recipe `scripts/deploy-beta-staging.mjs` explicitly sets `DOCKED_TEST_MARKET_READ_ONLY=true`. `src/server/marketplace.ts` projected this into `tradingEnabled=false`; `src/components/marketplace.tsx` displays the pause and disables transactions. `src/server/member-test-wallet.ts` rejects new listings, replacements, purchases and swaps. This is a deliberate hosted restriction, not a PayPal or Google Play dependency.

Private offers have an additional guard: `privateOfferEnabled` in `src/core/private-card-offers.ts` accepts only an explicit loopback, non-production local environment. `src/server/private-card-offers.ts` used that guard before any hosted offer operation. Merely copying `DOCKED_PRIVATE_OFFERS_LOCAL=true` into production cannot activate it.

The installed hosted migration chain already includes the marketplace integrity, private-offer privacy and current-session migrations through 17 October. Missing marketplace migrations were not the original pause cause. `docs/MARKETPLACE_RELEASE.md` and `docs/MARKET_OVERHAUL.md` explicitly distinguish prior local acceptance from hosted transaction approval. The latter records approved combined fees but leaves hosted trading policy/security acceptance outstanding.

## Prepared implementation

- Independent `DOCKED_BETA_TRADING=private-beta-trading-v1` capability; no funding/redemption control is changed. Hosted execution also needs explicit `DOCKED_TEST_MARKET_READ_ONLY=false`, the existing exact beta deployment guard, database policy approval, enabled modes and an approved actor and counterparty.
- New additive migration `20261018093956_reviewed_beta_marketplace_controls.sql`: paused/unapproved control, empty account list, restricted reporting and immutable-to-web-role audit. It does not grant credits, issue cards, admit members or approve policy.
- Sale, review, listing, swap and private-offer acceptance checks run under the existing settlement transaction's advisory lock 71820342. Owner pause uses the same lock. Missing configuration fails closed; cancellation and decline remain possible.
- Existing CreditsSandboxStore, core ledger, journal, scarcity, FIFO, immutable receipts, competition and collection guards remain the settlement authority. No second balance/ownership ledger.
- Owner MFA dashboard `/admin/marketplace`: emergency pause, guarded resume, approved accounts/modes, listings/offers, ledger totals, completed transactions, transfer receipts, sanitised failure records and manual dispute/suspicion/resolution records. Case entries do not reverse trades. Existing member moderation remains linked.
- Failure telemetry is recorded after rollback separately; unknown transport outcomes retain their request identity. A telemetry outage never changes the settlement result.

## Functional audit

| Operation                             | Implementation and boundary                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Browse and inventory                  | Existing marketplace projection; respects collection visibility and eligibility                                                    |
| Sell / Swap / Both, edit, cancel      | Existing list/replace-listing/cancel-listing engine; replacement is atomic, cancellation available while paused                    |
| Credit purchase                       | Existing explicit review + buy; quote and balance checked again in locked transaction                                              |
| Credit, card, combined private offers | Existing proposal/accept engine; original local guard retained, new independently reviewed hosted capability added                 |
| Decline, cancel, expire               | Existing transitions and effective expiry; acceptance rejects expiry, cancellation does not settle                                 |
| History and receipts                  | Existing immutable journal/state history; new dashboard only projects those records                                                |
| Fraud/disputes                        | Existing admission/blocks/moderation, plus manual owner case log; no automated fraud detector or automated compensation is claimed |
| Deposits / withdrawal / public entry  | Remain disabled by existing beta controls; marketplace activation does not enable them                                             |

## Release procedure (not executed)

1. Finish checks against the exact isolated candidate based on deployed commit `c10b0d1d5c8544409fae31e7107df95284d2c646`. Exclude unrelated NFL/ICON/local work. No push to the public repository.
2. Obtain explicit approval of `PRIVATE_BETA_TRADING_POLICY.md` and record the reference. Verify Owner, Barry and Luke's exact existing IDs; never infer membership from a display name.
3. Refresh recovery coverage if current live state differs from the verified snapshot. Apply the additive migration paused; verify grants and unchanged asset hashes. Record approval and roster under lock using a reviewed operator transaction, still paused.
4. Use authorised hosted acceptance arrangements. Do not create credits or use member assets as fixtures. Record the exact permitted cards/accounts/credit-fee limits before any hosted trade.
5. Build the exact candidate in the existing Vercel project without assigning live aliases. Preserve current application configuration. Set the new capability and explicit read-only flag only for the reviewed release. Database pause remains authoritative during deployment checks.
6. Verify authentication/MFA, owner-only controls, all supported settlements, rejection/rollback/idempotency, concurrent purchases, suspension, competition and privacy, and reconcile ledger/ownership. Promote only after required checks and approvals pass; resume through owner MFA control.
7. Recovery: pause first, retain additive SQL guards/audits, reconcile uncertain request IDs. Re-alias the recorded prior deployment if required; never restore a database snapshot over newer member activity as an automatic rollback.

## Current hosted read-only baseline

18 October 2026: state revision 137; state MD5 `0abc8282e53700c45acea73896d9e750`; 55 journals; 136 history records; zero unbalanced line journals; two OPEN listings; no private offers, deposits or withdrawals. No hosted business transaction or asset mutation was performed for this assignment.

## Outstanding acceptance

Policy operating decisions and hosted asset-use permission remain unapproved. The existing recovery receipt's revision-122 snapshot predates the current revision 137; refresh and verify recovery coverage before activation.

Real Auth/HTTP acceptance requires the existing Docker Desktop Linux engine. Its `dockerDesktopLinuxEngine` named pipe is absent, `docker desktop status` could not retrieve status, and one supported `docker desktop start` attempt did not bring it up. The isolated Auth endpoint `127.0.0.1:55341` is unavailable. No elevation, security changes, unrelated process termination or repeated startup attempts were used. The normal Git writes, build junction, network and production build work in this session; this is not evidence of a remaining Codex filesystem/network sandbox restriction.

Smallest environment action: open Docker Desktop and bring its existing Linux engine to **Running**. Then the prepared acceptance uses the existing pinned images and local fixtures:

```
node scripts/marketplace-auth-infra.mjs --market-overhaul
docker compose -f tmp/market-overhaul-auth/compose.private.json up -d
node scripts/beta-trading-auth-local.mjs
```

The wrapper exercises the reviewed database capability with `DOCKED_PRIVATE_OFFERS_LOCAL=false`, real local GoTrue sessions and owner MFA, then the existing sale/swap/combined/browser suite. Its generation and TypeScript syntax checks pass (`--prepare-only`); its actual Auth/HTTP acceptance is **blocked, not passed**. All fixtures and any local issuance stay exclusively in the existing loopback QA database. Hosted tests still need a separate explicit asset-use authorisation; do not substitute Owner/Barry/Luke's assets for the local fixtures.

## Verification results

Evidence directory: `docs/qa/beta-trading/`.

- Full workspace platform suite: **482 passed, 0 failed**. Full embedded database suite: **185 passed, 0 failed**, including the new control/grant/MFA/approval checks. Relevant follow-up marketplace/private-offer/admin suite: **21 passed**.
- Actual **PostgreSQL 17.10**, separate connections and the restricted runtime role: **11 acceptance groups passed**. Exactly one winner for concurrent purchases; purchase/cancel and swap/purchase contention; injected write-failure rollback; idempotent lost-response recovery; 100-credit sale yields 8 fee/92 proceeds; no negative wallets/new issuance; competition reservations/frozen snapshots and permanent rarity unchanged. A request waiting behind the owner pause observes disabled trading after acquiring the settlement lock. Pause leaves the asset state hash/revision unchanged.
- Current typecheck passes. The isolated candidate based on the deployed commit builds successfully and passes source lint. Browser assets pass the server credential canary scan after building with the documented synthetic canaries.
- Full workspace lint has one **pre-existing unrelated** error: unused `root` in the uncommitted `scripts/nfl-schedule-release.mjs`. That work is preserved and excluded from the candidate. Changed-file lint passes.
- Local real-component browser checks pass at **360 / 412 / 1440 px**, with the actual application styles: navigation, reason-required pause, one submission per click, pause status refresh, reporting-outage acknowledgement, no horizontal page overflow or page errors. Screenshots captured and visually inspected. This is not a physical Samsung device or authenticated hosted test.
- Live `/api/beta-release` remains HTTP 200 on `c10b0d1d5c8544409fae31e7107df95284d2c646`, deployment `dpl_ERnyiUPy9gVitRT3maECUKYgttBN`. No new deployment, hosted migration, approval, trading activation or asset mutation has been performed for this assignment.

An emergency pause now commits independently of ledger-report rendering. A subsequent reporting outage cannot roll it back. Resume still validates the economy and requires current approved controls. Case logs contain operator references; they are not an automated fraud detector, dispute adjudication or reversal mechanism.
