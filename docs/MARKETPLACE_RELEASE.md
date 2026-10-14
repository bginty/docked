# Phase 1 admitted marketplace release

14 October 2026. This is the current acceptance record, superseding the earlier local-only and Docker-blocked conclusions in MARKETPLACE_PHASE_ONE.md and MARKETPLACE_OPERATIONAL_ACCEPTANCE.md. The owner authorised the reviewed migration and exact application revision for the existing admitted test beta after the gates pass. No public admission or real-money activation is authorised.

## Decision and scope

Local release gates PASS. Hosted release identifiers and read-only acceptance are recorded in `qa/marketplace-release/`; deployment is not claimed until `live.json` passes. Existing member accounts, balances, cards, teams and history are not QA fixtures. No messages, invitations, paid services, grants or hosted business transactions are part of this release.

| Barry requirement | Current evidence/status |
|---|---|
| Scoring rules links, competition-specific copy, canonical NFL filters, K/DST collectible restrictions, draft/entry labels, seven-slot rules, readable rarity/supply | Already released in `fba1ae08`; preserved. Historical equal-scoring rounds unchanged. |
| Unified Browse / My Listings / Activity / Swaps at `/fantasy/market`; Collection sell links; wallet links | Implemented; component/browser and actual local HTTP acceptance PASS. No parallel wallet or inventory. |
| Exact instance/serial, test economy, fantasy salary versus Credit price, multipliers/eligibility; unavailable statistics | Verified in local mobile/desktop views. No invented statistics or cash values. |
| Sell/purchase/cancellation review; distinct confirmations; cancel before repricing; exact shortfall; stale/sold/cancelled recovery | Verified in browser and server suites. Unknown settlement retains the original operation identity and recovers its receipt. |
| Activity purchases/sales/cancellations/swaps and retained receipts | Verified; cancellations/free swaps do not invent financial ledger entries. |
| Owner-only reservation details with entry/slot links; generic restrictions for others | Real local authenticated two-mode entry and marketplace checks PASS. |
| Filters, pagination, bounded loading, retries, account switch, token refresh, keyboard/focus, responsive layout | PASS in separate actual-auth and synthetic-component evidence. Original deployed stuck-loading root cause remains UNCONFIRMED. |
| One card in both modes, lock, later transfer, original scoring entitlement and corrections | Integrated real local HTTP/Auth/database/worker chain PASS; synthetic retained match evidence, not actual Week 6 results. |
| Physical S24, genuine upcoming member-round observation | PENDING. Neither has been claimed or performed. |

## Executed acceptance

| Evidence | Result and boundary |
|---|---|
| [Integrated journey](qa/marketplace-authenticated/integrated.json) | PASS A–I: real GoTrue login, Next HTTP, PostgreSQL and canonical catalogue joins. Salary Cap and Open reserve the same owned card; one replacement still blocks, both release it. Different buyer purchases once; 1,000 = 75 commission + 925 proceeds. Worker creates 28 locked slots; later transfer preserves snapshots; late entry/insertion denied. |
| [Scoring/correction](qa/marketplace-authenticated/integrated-scoring.json) | Actual reconciliation/read/append-correction paths. Synthetic source records and explicitly compressed completion-observation chronology exercise the collection-delay gate. This is NOT historical provider acceptance, elapsed six-hour observation or genuine competition results. |
| [Restricted worker](qa/marketplace-authenticated/worker-role.json) / [exact bundle](qa/marketplace-authenticated/worker-bundle.json) | PASS with actual `docked_nfl_worker` login, both locked rounds and no duplicate scoring; both source and deployed-format bundle exercised. |
| [Separate connections](qa/marketplace-operational/postgres.json) | PASS 10 scenario groups, distinct buyers, purchase/cancellation, purchase/swap, entry/edit races, server kickoff, injected complete rollback, lost-response recovery. 100 = 8 + 92. No negative balances/new issuance. SQL fixture identity adapters here are separate from the real-auth integrated test. |
| [Platform](qa/marketplace-release/platform-final.txt) / [database](qa/marketplace-release/database-final.txt) | 342/342 and 152/152 PASS. Earlier test harness failures and their repair remain in prior logs; final run has no failures. |
| [Browser](qa/marketplace-phase-one/browser.json) | PASS: desktop 1440px, mobile 360/412px, keyboard/focus/Escape, accessibility and no horizontal overflow. Synthetic transport, NOT hosted transactions or physical Android. |
| [Actual browser readback](qa/marketplace-authenticated/integrated-readback.json) | PASS, real local member session and marketplace response/reload after all migrations. |
| Static/build | Typecheck, lint, isolated production web build PASS; [client boundary](qa/marketplace-release/client-boundary.txt) PASS (55 browser assets). |
| [Secrets](qa/marketplace-release/secret-review.json) | Reviewed PASS with documented raw findings. Raw scanner remains FAIL (9); no scanner weakening/exclusions. |

## Defects repaired during the connected acceptance

1. The strict NFL statistics mapping rejected valid round objects containing scheduling metadata. The worker now projects and validates only the adapter's declared mapping fields. Invalid source identities still fail.
2. A genuine existing legacy listing uses a non-UUID card identity. New reservation guards now accept that retained identity without casting it to UUID. No card ID/serial/history is rewritten; legacy commerce restrictions still apply.
3. The restricted worker lacked read permission for saved competition rules and entry snapshots. Column-limited SELECT and locked-round RLS now permit that existing worker path, without granting gameplay writes or broader member access.

## Migration review and rollback

Apply only these reviewed migrations to `pojoymtniryarxxunyvz`:

- `20261014021342_marketplace_phase_one_guards.sql`: one active listing, immutable terms/receipts, integer prices, shared reservation/competition lock, safe swap expiry and private market context.
- `20261014081315_marketplace_legacy_identity_compatibility.sql`: retained string card IDs remain valid; internal text overload has no member execution grant.
- `20261014081931_nfl_locked_worker_read_scope.sql`: registered locked NFL rounds only; SELECT on specified rule/entry columns; no UPDATE grant.

Read-only hosted inspection found no duplicate active listings, invalid price/state, ownership mismatch, reservation conflicts or malformed saved kickoff metadata. No hosted data repair is proposed. Application state and function/policy backup is preserved privately with a verified digest in [backup receipt](qa/marketplace-release/backup.json). This is affected-table recovery coverage, not a claim of complete Auth/storage disaster recovery. The previous deployed worker v14 is retained privately and can be redeployed with its original JWT setting and entrypoint.

Web rollback reference: `dpl_7WLNn8tA9Wdzz2ZJympK9CroCgba` / `fba1ae08a16882c91b47e9cb712b6b36e2933f49`. If health fails, promote that existing deployment within the same verified project. Prefer keeping additive database guards and retained history. Do NOT restore an aggregate backup over later transactions, drop receipts or decrement supply. If a database guard itself causes failure, first pause new trading using the existing runtime control; review a function-only forward repair against the private pre-release definitions. Preserve the extended expired-swap state and all newly completed business records. No destructive automatic down migration.

The release script asserts exact target/source/migration hashes, holds the existing shared transaction lock and compares member assets/entries/locks before and after DDL. It records an audit event. The worker bundle is built from that same reviewed source; schedules, source cooldowns and credentials are unchanged. No worker invocation/download is used as hosted smoke testing.

## Security disposition

The seven original raw findings are fixture/generated test credentials; an eighth is the local isolated-auth password interpolation. Each file/hash and rationale is retained in the reviewed report. The ninth is an untracked older APK bearer-download note: preserved untouched, not used, not staged, not deployed, not reproduced in output. It expires 18 October 2026 10:44:54 UTC (21:44:54 Sydney). It was not expired at inspection; remote validity was not tested. No occurrence was found in tracked source/public/build/release output or Git history. This cannot establish whether it was shared previously elsewhere. There is no current evidence requiring revocation and it does not block this release. If unintended sharing is reported, invalidate the specific old APK object/link; do not rotate unrelated project credentials.

## Android and remaining observation

[v22 shell inspection](qa/marketplace-release/v22-shell.json) confirms `https://docked.com.au/app`, HTTPS-only and logging disabled. Existing signed package identity is unchanged. No native code/config changed: v22 receives the deployed web update after fully closing and reopening online. No new APK is required or distributed.

S24 review for owner/Barry: browse/filter/details; distinguish fantasy salary from Credit price; inspect sell/cancel and purchase reviews and retained receipt; check reservation links; Back, scrolling and touch targets; close/reopen and offline/retry without duplicate settlement. Transaction checks must use designated QA assets. Creating hosted QA assets/admitting a QA identity needs separate explicit authority; do not risk cards in existing member competitions.

Hosted QA identity remains revoked. Read-only hosted checks must not temporarily enable it or borrow owner/Barry sessions. Successful authenticated business acceptance is local; hosting checks cover target, routes/admission denial, migration/projection compatibility and deployed version. No hosted transactional acceptance is claimed. Real future-round results and S24 remain pending independently.

## Screenshots

Local synthetic component evidence, not live member data: [Browse mobile](qa/marketplace-phase-one/browse-mobile.png), [Browse desktop](qa/marketplace-phase-one/browse-desktop.png), [Sell review mobile](qa/marketplace-phase-one/sell-review-mobile.png), [Sell review desktop](qa/marketplace-phase-one/sell-review-desktop.png), [Purchase review mobile](qa/marketplace-phase-one/purchase-review-mobile.png), [Purchase review desktop](qa/marketplace-phase-one/purchase-review-desktop.png), [Activity mobile](qa/marketplace-phase-one/activity-mobile.png), [Activity desktop](qa/marketplace-phase-one/activity-desktop.png).
