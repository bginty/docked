# Google Play launch blocker resolution — 2 November 2026

Status: protected customer acceptance restored and passed; **public submission / payment activation NO-GO**. The owner's commercial model and conditional submission authority remain approved. No repeat approval of that model is requested.

## Implemented and deployed

- `819523a0`: restored existing free Preview, strict public-customer acceptance binding, dormant retention controls and policy revision.
- `040a50a1`: genuine hosted signup/email confirmation harness; narrowly scoped read-only synthetic commercial projections. Synthetic identities cannot verify receipts, purchase/open packs or reconcile commercial transactions.
- `f1a94451`: use the existing serverless connection-pool policy for Preview and the commercial runtime; account-deletion acceptance and public Terms routing.
- `7161f6ef`: public Profile commercial-inventory projection, retaining existing privacy and transfer locks; strengthened rendered acceptance.
- Protected Preview: https://docked-preview-s24-briant-ginty.vercel.app → `dpl_GGZr5FasrjnAypUnUgNhMcswt1dk`, source `7161f6efe7078673b5c79ab38bdac17a05a89c03`.
- Closed-gate Production-target candidate: https://docked-production-owjmvt5sx-briant-s-projects.vercel.app, same source. Built with the Production configuration and **not assigned to docked.com.au**. Exact deployment ID/readback is in `closed-candidate.json`.
- Live domain remains `053848ed67946fdd727a5c1d8547272d383c9470`, `dpl_2bWUkY1sgtshkifqRRty89oPfuzQ`. This turn made no Production database changes or live-domain promotion.

The restored database is `bckkllmndoxzpzdqrevb`, existing Free plan and existing Vercel project; no paid add-on or recurring service was created. A fresh encrypted 3,609,714-byte database archive was restored in isolated local PostgreSQL before compatible Preview migration catch-up. Archive SHA-256: `5548a174897a59f65f1c1177bcda1340d59cf771dbbc2187b5367ec95e96d7f3`. The restore and migration evidence are in `qa/launch-resolution-20261102/restore/restore-drill.json` and `preview-migrations.json`.

The temporary Auth admission admitted exactly two expiring synthetic addresses through normal registration and token confirmation. It did not create an admin-confirmed user or weaken owner MFA. Email was captured privately through a scoped Auth hook, **not delivered to an external inbox**. The original loopback hook was preserved. Both Supabase signup and the application registration flag are now closed; both admissions revoked; the temporary email limit restored to two/hour. Existing synthetic practice fixtures remain isolated and expire in seven days. `preview-window-closed.json` records zero commercial cards, receipts and funds.

## Actual acceptance

| Flow | Observed result | Evidence |
|---|---|---|
| Normal signup, verification, password login and onboarding | Passed for two synthetic members. Actual Auth confirmation token consumed; no admin bypass. | `member-signup.json`, `deletion-signup.json` |
| NFL/AFL/NRL free Core | Passed without private-beta membership or collectible ownership. 7/22/13-player formations. | `member-play.json` |
| All-Star and Traditional | Six confirmed no-prize practice entries; draft save, entry, persisted lineup and rendered Rankings passed. Traditional caps 4.4m / 13.8m / 8.2m. | `member-traditional.json`, `member-existing.json` |
| Inventory / billing isolation | Zero collectibles, receipts or credited funds; commercial mutation requests and NBA denied; anonymous wallet denied. | `member-denials.json` |
| Cards, Packs, Market, Profile and policies | Signed-in rendered routes returned successfully without horizontal overflow at 390px. Final play also captured at 1440px. Empty inventory was authoritative, not an error fallback. | `member-screens.json`, final screenshots |
| Account deletion | Customer typed DELETE and submitted through the real hosted form; access revoked and work queued. Scoped worker erased only that synthetic Auth/profile, completed one audit and safely repeated. Eight consent records and unrelated/financial records preserved. | `deletion-deletion.json`, `hosted-deletion-worker.json` |
| Candidate gates | Commercial, admin, wallet and all public sport APIs returned private/no-store 403 without a member session. Five policy/deletion pages returned 200; revised policy version verified. | `closed-candidate.json` |
| Genuine Google purchase/refund / device | No new order or physical test this turn. Prior authorised 4,900/9,900 TEST journeys remain recorded; they are not claimed as a new public-mode purchase. | Existing acceptance history; current `google-readiness.json` is read-only |

Evidence timing: signup/entry/deletion were observed on `819523a0`/`040a50a1`; persisted Play and wallet checks on `f1a94451`. The final `7161f6ef` changes the commercial Social/Profile projection only. Cards/Packs/Market/Profile/policy rendering and mutation-denial checks were repeated on that deployment. Completed entry and Google purchase scenarios were not repeated without cause.

Wallet/Cards failure root cause: `EMAXCONNSESSION`, 15 sessions reached on the restored Supabase session pool. Preview had omitted the existing `DATABASE_RUNTIME=serverless` setting; commercial runtime also used a separate three-connection pool without idle expiry. Reused the existing max-one/20-second-idle policy for serverless. Retired seven idle connections belonging only to the synthetic Preview roles. Final authenticated wallet and Cards checks passed. No ownership, account permission or RLS relaxation was used.

Profile failure root cause: its Social collection projection still selected the legacy `credits_sandbox`, which the public runtime correctly cannot access. Visual inspection caught the recoverable panel error despite HTTP 200. The commercial branch now uses a narrow server-only database function, current opened-card ownership and the existing profile/per-card privacy function. Card row locks persist through a social snapshot transaction, preventing a concurrent transfer from invalidating an ownership claim. No legacy sandbox access was granted. Hosted acceptance now explicitly checks the Profile collection request and rendered panel.

Screenshots in `qa/launch-resolution-20261102/`: `final-nfl-play-390.png`, `final-afl-play-390.png`, `final-nrl-play-390.png`, corresponding `1440` versions, `member--fantasy-cards-390.png`, `member--fantasy-packs-390.png`, `member--profile-390.png`. These contain **synthetic practice data and are QA evidence, not public store marketing assets**.

## Production and migration integrity

Re-read all three approved applied migration statements and local files; each SHA-256 still equals the approved package. **None was reapplied.**

| Migration | SHA-256 | Status |
|---|---|---|
| `20261101120754_commercial_google_ledger.sql` | `a9d77454705a9c827155f1a07acda040ce48e5fb6911bf793edc3e0efed7a28c` | Already applied, unchanged |
| `20261102010000_commercial_lineup_inventory.sql` | `c39d5da280d2d76226740d904e93732b2ca6ecffee505bf1803924b0e54e995b` | Already applied, unchanged |
| `20261102010001_public_customer_gameplay.sql` | `121e97e5e41d160aee4f7bcdcd92fcaee2aae87c547c17a7af7b71ded978b4f2` | Already applied, unchanged |

Current read-only Production check: registration/public gameplay/commercial sales/issuance/transfers/gameplay off; zero public-enabled rounds; zero commercial receipts, cards and funds; no NBA public-sport row. Existing private-beta gameplay remains separate. Census: six Auth users, 59 beta cards, 59 ownership events, 17 beta entries, 11 beta pack items and nine schedules. This is a current census, not a claim that no legitimate customer/cron activity occurred since the earlier 310-table transactional integrity check. This turn performed **zero Production DB mutations**. See `production-gates.json` and retained `qa/approved-production-20261102/apply.json`.

New additive migration **`20261102011703_commercial_retention_controls.sql`** is tested and applied only to restored Preview. It is absent from Production. Its separate approval, backup/checksum review and restricted runtime provisioning are needed before Production application; activation is another step. It creates no scheduler and is dormant by default.

The Profile correction also requires **`20261102023100_commercial_social_inventory.sql`**, applied only to Preview. [Exact hashes, tests, impacts and rollback for both](REMAINING_DORMANT_MIGRATIONS_20261102.md). Neither affects historical entries or activation flags.

## Rights, marketplace and classification

See [evidence-backed decisions](LAUNCH_RIGHTS_AND_CLASSIFICATION_DECISIONS_20261102.md) and the prior [rights matrix](COMMERCIAL_RIGHTS_MATRIX_20261102.md).

- Factual names/positions do not automatically require a copyright licence. Source contracts, compilation/adaptation rights, branding and paid-player presentation are separate questions.
- NFL general nflverse data has an attributed CC BY 4.0 route; FTN and other separately licensed feeds must not be conflated. AFL/NRL roster adaptations have pinned Wikipedia attribution/ShareAlike and Wikidata CC0 identity options. Squiggle basic AFL results do not supply complete licensed player-game fantasy statistics.
- No executed covering paid-player-card merchandising/likeness agreement was found. Obtain a scoped legal basis/opinion for Docked's actual original, name-based cards and marketing or appropriate permissions. This is not a claim that every factual player name needs licensing.
- Omit unlicensed logos, photos and provider feeds. Original jerseys and factual text remain subject to avoiding misleading endorsement and protected distinctive artwork.
- Credit sales settle within Docked. There is no enabled cash-out, general credit-transfer product, card export, paid entry or real-world prize flow. Public commercial transfers remain off. Disabled/historical code and beta transactions are preserved.
- Paid randomised purchases imply Australia's minimum M classification, distinct from simulated gambling. Full pack/multiplier/resale mechanics require the focused Australian and Google policy assessment described in the decision matrix. No regulatory clearance is invented.
- IARC's saved real-world-currency summary must be checked against the exact current question. Do not answer from a paraphrase or simply change it to obtain approval.

## Policies and retention

Live URLs are reachable and still serve preparation v1:

- https://docked.com.au/privacy
- https://docked.com.au/refund-policy
- https://docked.com.au/retention
- https://docked.com.au/commercial-policy
- https://docked.com.au/account-deletion

Revised `2026-11-02-release-preparation-v2` is implemented and rendered on protected Preview/candidate only. It accurately discloses the approved model, Play credits, random packs, non-withdrawable credits, transfers, consumer-law remedies, recovery holds/appeal and account-deletion limits. It does not assert legal clearance or active commercial payments. Prior accepted policy content is archived; consent history is not rewritten.

Retention implementation: scoped encrypted minimisation/archive, legal holds, bounded worker, transactional audit, dry-run/default disabled and no financial/token/Auth/card deletion grants. Seven-year covered company financial records are distinguished from operational 90-day completed-job and 30-day archive proposals. Twelve real PostgreSQL scenario groups passed, including concurrent hold/worker serialization and rollback. Purchase-reference/tombstone retirement and actual mailbox/provider backup retention remain explicit decisions. See [operations/activation runbook](COMMERCIAL_RETENTION_OPERATIONS_20261102.md). Do not activate deletion merely because an uncertain period expires.

## Android, products and Console

Android **v30 / 1.29** preserved. Package `docked.fantasy`. `artifacts/android/Docked-commercial-candidate.aab`, 9,214,095 bytes, SHA-256 `d3837d7191e0a6bbd64a572a9ac3288fd37b440eb36e67408648fb4b3c879e29`. Google read-only API confirms generated version 30 and signing artifacts.

Both Australian Google purchase options remain **INACTIVE**:

- `docked_credits_4900_v1` / `buy-au`: **A$49 → 4,900 credits**.
- `docked_credits_9900_v1` / `buy-au`: **A$99 → 9,900 credits**.

These are credit packages, not direct A$49/A$99 pack prices. Existing Standard 1/3/9 costs 100/300/700 credits; Premium 1/3/9 costs 700/1,900/5,000. No price, pool, odds or permanent supply changed.

Last verified Console state remains Australian version-30 Production draft, managed publishing enabled, saved but unsubmitted changes. Reviewer `briantginty21@gmail.com` was previously normally verified and its Console credentials entered by the owner. This turn did not read/store its password or claim a new reviewer sign-in. No declarations, attestation, review submission or publication occurred this turn.

Computer Use stopped because it could not establish the browser URL sufficiently to enforce policy. No alternate browser-control workaround was attempted. APIs and isolated app browser tests continued. Exact pending Console actions: App content → Content ratings, review the fresh IARC terms personally if appropriate, inspect the marketplace questions and correct truthful answers; re-check target audience, Financial features, Data Safety, app access, privacy/deletion URLs and Australian rating against the final configuration. Refresh listing screenshots after real public-roster configuration is accepted; do not upload synthetic QA fixtures as production features.

## Tests actually executed

- Full platform run: 714 tests, 712 initially passed, two standalone build-guard fixture failures. Added the missing new guard dependency to both fixtures; targeted rerun 13/13 passed, including both failures. Do not describe the first full invocation as clean.
- 17 targeted commercial/client-boundary cases passed; final pool/environment/Auth tests 8/8 passed.
- Twelve real PostgreSQL retention scenario groups passed.
- Commercial social projection passed real PostgreSQL ownership/privacy/session/role/concurrent-transfer checks; existing collection privacy and expiry regression tests passed 2/2.
- Existing Production runtime permission/account-deletion regressions passed 13/13 after the final projection addition.
- Encrypted Preview restore, 28 compatible missing migrations and idempotency checks passed; application retained historical records and changed only six eligible empty future QA rule snapshots as rehearsed.
- Typecheck passed. Full lint passed before the final narrow scripts; changed-file lint passed. Local production build passed and 96 browser assets were checked for secret canaries. Both final hosted builds reached READY.
- Actual signed-in acceptance and read-only final-candidate checks are detailed above. No new physical-device or genuine Google notification delivery is claimed.
- Final sensitive-value scan checked 169 files and browser assets against 17 actual isolated credential/session values: no exposure found.

## Remaining release gates and exact next actions

1. External: focused Australian legal/platform assessment of paid packs + player-identified collectibles + multipliers + permitted credit resale, and evidence for any required player/data/art permissions. Preserve the approved model; keep unsupported feeds/assets/transactions disabled.
2. Owner/operations: approve the final policy text and specific retention decisions; separately review the two new additive migrations in the linked package. Existing three approved migrations need no further action. Configure customer-email delivery and provider retention settings, rather than representing private capture as real inbox delivery.
3. Console owner action: fresh IARC terms/attestation as appropriate; verify exact marketplace answers and paid-content/reviewer declarations. No repeat commercial-model approval is required.
4. Technical final acceptance: activate only an explicitly supervised licence-test route for the final customer release configuration, with authorised tester identity and real Google TEST checkout. Prior beta TEST receipts/refunds passed; this restored environment deliberately cannot fulfil commercial receipts from synthetic addresses. End-to-end final-config purchase/pack/refund/RTDN and external email delivery remain pending, without claiming earlier results cover a changed deployment. No physical-device request is needed until that exact window is ready.
5. Prepare actual future public no-prize competitions and verified roster eligibility under approved regional/policy versions. Six synthetic practice rounds prove the engine, not real-world scheduling or rights. Production remains at zero public rounds until deliberate final configuration.
6. After mandatory gates pass, use the existing conditional authority for Google review with managed publishing still enabled. Public signup, real charges, withdrawals, paid entry and prizes are not enabled by staging or submission. Do not promote the candidate or activate products before final gate evidence is recorded.

Rollback: leave the live alias on the recorded existing deployment. Preview can be removed from its alias without touching Production; signup is already closed and test admissions revoked. Keep approved additive Production schemas and historical ledger records. For retention, disable apply/service, retain encrypted archives and audit, and never replay a completed fulfilment as recovery. No destructive rollback is proposed.
