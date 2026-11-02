# v30 customer billing acceptance and release gate

2 November 2026. **Public release: NO-GO. No new Google checkout succeeded in this session.** Earlier v29 TEST successes and protected public-onboarding acceptance remain valid evidence for their tested versions; they are not substituted for v30 customer-runtime acceptance.

## Actual Samsung result

- Google Play-installed `docked.fantasy`, version code **30**, version **1.29**, installer `com.android.vending`. The installed APK contains the two expected commercial product identifiers; its TEST-only product configuration is empty.
- Normal authenticated isolated Preview member reached the customer wallet through the installed app. Wallet: **0 available, 0 held**. NFL/AFL/NRL visible; NBA absent. No owner wallet was used.
- The customer runtime authorises `docked_credits_4900_v1` (A$49 / 4,900 credits) and `docked_credits_9900_v1` (A$99 / 9,900 credits), without bonuses.
- During the specifically authorised temporary TEST window, Google Console and Android Publisher API both confirmed each `buy-au` option ACTIVE, Australia AVAILABLE, AUD49/AUD99. Multi-quantity purchases remain off.
- Device Play account matched the approved licence-test account; the selected country/profile was **Australia**. No country, payment profile, account or security setting was changed. Only Play Store cache was cleared, not app data.
- BillingClient connected successfully. At **09:48:13 UTC** after the cache refresh, it returned `UnfetchedProduct.statusCode=4` for **both** products. This is **NO_ELIGIBLE_OFFER**, not a missing product ID or a Docked wallet error. The screen reported zero Google products and two server-approved products.
- Google documents this code as a found product with no eligible purchase option: [UnfetchedProduct.StatusCode](https://developer.android.com/reference/com/android/billingclient/api/UnfetchedProduct.StatusCode). Availability/country configuration and propagation are possible causes, not an established diagnosis of Google's internal state: [Billing response guidance](https://developer.android.com/google/play/billing/errors#item_unavailable).
- No native purchase sheet became available. Consequently **A$49/A$99 purchase, nine-card issuance, refund-before-spend, refund-after-spend, replay fulfilment and genuine RTDN acceptance remain PENDING on v30**. No real payment method was used.

## Engineering completed and tested

| Change | Evidence / status |
|---|---|
| Expiring, explicitly selected transport from installed v30 to existing protected Preview | `ae28cc65`; separate immutable Preview target, Preview Auth cookies only, no Production credential forwarding or fallback. Real Production remains gated. |
| Authenticated notification relay to isolated commercial receipt queue | `a87d3e2c`; original Google signature, audience, identity and subscription validation preserved. Durable/idempotent processing tested. **No genuine new Google notification observed in this session.** |
| Current store-price refresh and isolated-only diagnostics | `a462f8f3`; no invented prices/offer tokens; no purchase without Google's eligible offer. |
| Commercial read quota separated from mutation quota; empty reconciliation no longer broadcasts a wallet change | `57ec798b`; actual device navigation exhausted the former shared 15/minute quota. Reads now have their own 90/minute quota; purchases retain 15/minute. An authenticated 25-read hosted burst returned 200 throughout without consuming the mutation counter. |
| Explicit Android recovery for expired isolated connection | `57ec798b`; ordinary HTML provides Exit/Reconnect. API/RSC/mutations still fail closed. Avoids the native offline handler hiding the recovery controls. |
| Operator closure and integrity tooling | Closing the isolated control is idempotent and retains receipts, ledger, definitions and audit records. No schema migration. |

Executed checks: initial 55 targeted tests passed; relay checks 15 passed; transport/header checks 6 passed; final commercial/isolated-transport/Preview set **26 passed, zero failed**, including the seven transport recovery cases. Typecheck and targeted ESLint passed. Protected Preview and staged Production transport builds reached READY. These overlapping runs are not claimed as a single enlarged suite or a fresh full-platform regression. Earlier full-platform/SQL results are retained rather than needlessly rerun.

Hosted normal login and member/product/wallet readback passed both directly in Preview and through the temporary transport. These are authenticated hosted checks, **not** Google purchase acceptance. Physical Samsung login/session restoration and isolated-wallet rendering were observed. No device purchase outcome is inferred from local tests.

## Test window closed and Production preserved

- Both Google options were deactivated and confirmed **INACTIVE by API at 09:50:35 UTC**. Screenshots: `qa/v30-customer-billing-20261102/google-4900-inactive.png`, `google-9900-inactive.png`.
- Samsung exited TEST normally and returned to Welcome back. Temporary BillingClient verbose logging was restored to its empty/default setting.
- Isolated sales, issuance and transfers are closed. All 180 synthetic catalogue definitions remain in the isolated environment, with **zero receipts, issued cards and packs**; no audit history was deleted.
- `docked.com.au` restored to **f0eb28e7a6f9621574399e894aadbef20ff25cdd**, deployment `dpl_6kKiZfN6qcin6HFJ3psRLs2qeakv`. `/api/beta-release` confirms that identity and public registration false; ordinary commercial purchase API returns 404. Approved policy v2 remains live.
- All **39 protected table counts and complete-row fingerprints matched** the before snapshot, covering recorded wallet/ownership/transaction/competition data and `cron.job`. This is not a claim that unrelated Auth sessions or all database tables were compared.
- No new Production migration was applied. The previously approved dormant migrations remain applied. Retention cleanup is disabled, authority unset, archives zero; no financial/card records were altered.

The final protected application candidate is **57ec798bb094228ec5aa056dc4d6a3a0c5c2e66f**, `dpl_FYeRfkAPgwawdhR7oy33Wh3PSa6U`. It is engineering preparation, not activated commercial Production. The temporary Production transport branch reached `db4be8f1cdb76b868576de6925190d95caa7b344` and has been withdrawn from the live alias.

## Retention and commercial conditions

The applied retention controls support bounded encrypted archives, audit, explicit legal holds and restoration. **Irreversible cleanup remains disabled.** See `RETENTION_CUSTODY_ACCEPTANCE_20261102.md` for the remaining operational schedule, reference-retirement decision, named operational/recovery custodians, independent key recovery copy and verified provider backup/log settings. The 90-day job plus 30-day archive proposal is not represented as a statutory period. Covered company financial records retain the applicable seven-year minimum; unresolved holds prevent deletion.

Owner-confirmed player-name usage is accepted and is **not** requested again. Original generic artwork remains; no new photos/logos/provider rights are asserted. Existing attributed open roster and applicable historical data packages may be used within their documented terms. No SportsDataIO, Champion Data or proprietary NRL player-statistics agreement is evidenced; those feeds remain disabled. Missing proprietary statistics do not alone block a roster/card launch.

Paid randomised packs have the Australian minimum M classification; this does not automatically make them gambling or establish a gambling clearance. The remaining specific assessment concerns paid cards/rarity advantages together with transferable closed-loop credits/cards and any prize/value pathway under applicable Australian rules and Google policy. No enabled cash withdrawal, general credit transfer, off-platform card export, paid entry or prizes was identified. Proposed initial commercial transfer setting remains OFF pending that assessment; existing isolated beta sales/history are preserved. This is disclosed, not a silent change to the approved model. See `LAUNCH_RIGHTS_AND_CLASSIFICATION_DECISIONS_20261102.md` for primary sources and the exact question for a scoped adviser review. No generic licence/certificate or fresh commercial-model approval is being demanded.

Recovery holds must remain proportionate and reviewable, preserve statutory consumer remedies, and never automatically charge a bank account or claw back unrelated owners' inventory. The approved public wording remains:

- https://docked.com.au/privacy
- https://docked.com.au/refund-policy
- https://docked.com.au/commercial-policy
- https://docked.com.au/retention
- https://docked.com.au/account-deletion

All five URLs returned 200 after restoring Production. No new wording was published in this session.

## Google Play and exact remaining actions

Console still shows **10 changes not submitted**, **Managed publishing on**, **30 (1.29) AU launch candidate**, Australia-only distribution, target audience 18+, saved privacy/Data Safety/app-access/financial declarations. Australian classification is **Mature (M)**. No legal attestation was accepted, public release submitted or publication activated in this session. Reviewer access and protected registration/email/recovery/free-Core/account-deletion results from the acknowledged prior acceptance are preserved, not falsely reported as rerun.

1. Resolve Google's **NO_ELIGIBLE_OFFER for both active Australian `buy-au` options**. The next meaningful test is offer eligibility after Google configuration propagation or Play support correction, not another synthetic wallet test. `GOOGLE_NO_ELIGIBLE_OFFER_SUPPORT_20261102.md` is a prepared support request; it has **not been sent**.
2. Under a supervised TEST-only window, repeat the pending v30 journey: A$49 credit and refund before spending; A$99 credit, Standard9 (700 credits) and Premium9 (5,000), exactly 18 isolated cards, remaining 4,200; refund with the appropriate 5,700 spent-credit recovery hold; duplicate checks and genuine signed RTDN persistence. These numbers are expected assertions, **not observed outcomes**.
3. Settle the specific external paid-pack/transfer assessment and any separate source/design permission actually applicable; keep unlicensed feeds and cash/prize pathways off. Business-model and player-name approvals stand.
4. Approve operational retention periods and key/recovery custody before cleanup; verify support/backup handling against the published targets. No repeat migration or policy-wording approval required.
5. After technical/commercial/platform gates pass, use existing conditional submission authority with managed publishing. Live products, registration and public publication remain separately gated. Do not press Submit merely because Console's button is available.

Evidence index: `qa/v30-customer-billing-20261102/` contains active/inactive Google API snapshots, authenticated readback, read-burst statuses, isolated ledger/closure, Production before/after fingerprints, release identity and Console screenshots. No passwords, purchase tokens or private key material are included.
