# Google Play continuation — 1 November 2026 (Sydney)

Public paid launch remains **NO-GO**. This continuation closes the member TEST-wallet integration and free-Core eligibility gaps in code, tests them locally, and stages a protected server candidate. It does not claim genuine hosted customer checkout, public onboarding, reviewer login or commercial approval.

The verifier and settlement adapter deliberately accept TEST receipts only. This is not a production-money adapter waiting for one flag: after approval of the commercial funding, refund and beta-to-public separation rules, that exact real-money contract must be implemented and accepted before any paid activation. Do not relabel the existing financial sandbox as a commercial ledger.

Implementation commit: **1dfe3239c6059cfd0aa4d8aa249fd9d3920ee9c5**, pushed to `codex/member-platform-updates` after 9a0f2d69. Later report-only commits contain this evidence. The application changes are in the existing Docked repository and shared components/services.

## Delivery and activation

| Requirement | Implemented and tested | Deployment / remaining condition |
| --- | --- | --- |
| Google customer-wallet integration | Native Android test panel, authenticated receipt API, server OAuth verification, account binding, exact product/version admission, same wallet/ledger and pack engine, encrypted references, durable consumption outbox. Real receipts rejected. | Protected candidate only; new gate off, no account grants, no new runtime purchase secrets. Not active on docked.com.au. |
| Free Core without purchases | Competition-scoped gameplay eligibility for NFL/AFL/NRL. Uses reviewed existing player IDs, expiry and saved rule opt-in. Does not mint ownership, serials or supply; excluded from My Cards and market. Existing server lineup validation reused. | Migration prepared, programmes disabled, no roster seeded or existing round changed. Public registration deliberately remains closed. |
| Pack/refund/reconciliation | All 18 paid-credit pack variants tested with shared wallet. Exact-once receipt, purchase and opening; refunds cannot become extra credits or confiscate unrelated inventory. Revoked admission is rechecked under transaction lock. | Local synthetic provider and disposable PostgreSQL. Prior genuine Google tests remain operator-ledger evidence, not acceptance of this new member route. |
| Reviewer access | Dedicated ordinary-member instructions prepared, including all sports, security flow, cards, packs, reporting and deletion. | Credentials not provisioned or tested. Owner must nominate/confirm a reviewer identity and enter its credentials securely; no owner credentials or MFA bypass. |
| Policies | Privacy/refund drafts reviewed; deletion and commercial decision drafts added. Existing accepted policy hashes unchanged. | Owner/legal approval and accurate publication still required. Live beta policy is stale for the proposed public product. |
| Play Console | Existing listing/icon/feature graphic/three NFL/AFL/NRL screenshots reviewed and saved as **Ready to send for review**. Dashboard now **5/11**, up from 4/11. | Not submitted. Production track inactive. Six declarations/access tasks remain. |
| Android | Existing signed v25 / 1.24 audited; Google generated-build/signing readback succeeds. | Native billing allowlist empty. No connected Android device during this continuation; no new install/checkout claim. |

## Root causes fixed

The previous receipt orchestration was isolated from the actual member wallet. When connected, the wallet guard rejected every deposit, including a genuinely verified Google TEST receipt. The credit-only capture path also marked its funding lot redeemable. Settlement now writes server-authored TEST provenance atomically; the member guard admits only those verified deposits and capture makes their funds non-redeemable. Ordinary deposits, withdrawals, live-money policy and client-supplied funding claims remain rejected.

Free-Core availability had no authoritative gameplay-only path compatible with the owned-card picker. A new eligibility projection uses the same competition-scoped inventory function for read and save validation. It is not catalogue ownership. NFL, AFL and NRL adapters label the distinction, filter by eligible competition, and preserve locked snapshots. Paid-card uniqueness, positions, salary caps and multipliers remain unchanged. The programmes are explicitly opt-in, so historical owned-only rounds are not silently rewritten.

The Android audit previously compared the internal build against the wrong hosted-preview expectations. A dedicated `StoreInternal` mode now checks the exact closed-gate manifest, production HTTPS origin, disabled inspection/logging, package and embedded branding pages.

## Tests actually run

| Check | Actual result |
| --- | --- |
| Full platform suite | **688 passed**, 0 failed, 0 skipped; `qa/public-launch-final/platform-continuation.txt`. Includes NFL/AFL/NRL and existing NBA/scoring regressions. |
| Full database suite | **225 passed**, 0 failed, 0 skipped; `database-continuation.txt`. These use the repository's migration/PGlite fixtures. |
| Extended free-Core boundary and entry tests | Both tests passed after extending Traditional plus All-Star entry coverage. NFL seven-player Core test also passed in its full regression. Zero collectible issuance; cross-account, expiry, inactive roster, duplicates and wrong-round denial; historical snapshot retention. |
| Store lifecycle targeted tests | **23 passed** including all 18 pack products, proof tampering/client deposit rejection, non-redeemable funding and refunds. These are included in the platform result, not extra unique suite totals. |
| Disposable real PostgreSQL | **5 checks passed**: 20 duplicate notifications; 12 workers; 16 purchase retries; 10 opening retries; admission revocation, worker lease recovery, outage/restart and spent-refund safety. Provider mocked, zero customer connections/charges. |
| Rendered local AFL / NRL | Actual shared component and SQL command path: Auto Select review, full Core lineup, explicit Enter Team and Refresh persistence. AFL 22/22, $11m used of $13.8m; NRL 13/13, $6.5m used of $8.2m. No owned inventory or purchase. 390px checks showed no horizontal overflow; AFL also inspected at 1440px. |
| Rendered local member wallet | Mock native Google confirmation → server receipt orchestration → same wallet displays 9,900 test credits. Retry preserves amount; cancellation does not credit; refresh retains state. This is visibly labelled synthetic and is not Google-hosted checkout. |
| Typecheck / lint / build | Passed. Production build completed, including the new API. Protected Vercel build also completed. |
| Secret review | 140 staged-source/browser-asset files checked, zero findings; configured local known-secret comparison plus generic signatures. APK audit: 1,046 entries, zero credential/forbidden-file findings. |
| Protected hosted access | 19 existing HTTP assertions plus 3 new store/mobile/NBA assertions passed. These are unauthenticated application-access denials using existing Vercel authentication, not member acceptance. |

Browser mutation tests used only disposable synthetic local accounts/databases. No production purchase, grant, team save, balance mutation, refund, email or prize award was performed. Full-page browser captures intermittently timed out; viewport captures were used and visually inspected instead. The first candidate HTTP attempt reached Vercel's build-in-progress page and was not counted as a pass; checks were rerun successfully after build completion.

## Actual hosted evidence

- **Live site remains** [docked.com.au](https://docked.com.au), commit `673a751b2ec755836ef31dfb9b967786861c7b99`, deployment `dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9`.
- **Protected candidate:** [1dfe3239 deployment](https://docked-production-c2a9tol2u-briant-s-projects.vercel.app), `dpl_54hrgdhenETWAnr3AacYtkDrRitw`, READY. Staged with `--skip-domain`; docked.com.au not moved. The legacy deployment recipe's NBA umbrella flag is retained because AFL/NRL depend on it; the customer NBA server boundary still returns 403. This is not NBA activation.
- Existing genuinely signed-in owner browser session was inspected read-only: NFL Week 7 showed **105.81 PTS, 6/7 completed, rank 1 of 2**. AFL's 22-slot interface and NRL Traditional Round 3's **$8.2m** cap loaded. No owner draft or entry was changed. An existing AFL draft included unavailable transferred cards; it was left intact and is not claimed as a clean onboarding test.
- Production shared test-wallet snapshot remained **revision 226**, MD5 `5f6b1926b820cb90f68d9a6a01ab5d5e`, zero deposits. This is before/after read-only evidence for this continuation, not a claim that every historical customer workflow was re-executed.
- Google API readback: both `docked_credits_4900_v1` and `docked_credits_9900_v1` Australian purchase options **INACTIVE**. OAuth/catalogue/refund readback and generated v25 APK queries returned 200. No Google API mutation during this continuation.
- Hosted isolated acceptance role remains NOLOGIN with its 1,000-call allowance exhausted. It was not silently reopened or increased.
- Supabase advisory: leaked-password protection is disabled. No plan purchase or unreviewed authentication change was made. Review the available protection/plan before public launch.

## Android artifact

`artifacts/android/Docked-public-candidate.aab`, package `docked.fantasy`, versionCode **25**, versionName **1.24**, min SDK 24, target SDK 36, 9,213,282 bytes.

SHA-256: `3656d9b88797f5bc9a8cbae1b29995717631b478cd7b31002228caaa900e0f85`.

Google reports 173 splits plus a universal APK and signing SHA-256 `64:F8:4E:E6:33:3C:E0:FE:7A:E3:08:A3:81:B0:9B:BF:AA:C0:2A:E6:EA:5A:CD:47:68:91:9C:E0:BC:DD:28:F1`.

No native source change required rebuilding this payment-disabled artifact. It is **not** a paid-public-launch acceptance artifact: its product allowlist is empty and it uses the live site, not the staged candidate. A separately versioned, supervised TEST build and connected Play-installed device are still needed for the new member integration.

## Migration and supervised acceptance procedure

Neither new migration is applied to Production (application-history count confirmed zero):

1. `20261031123611_free_core_gameplay_eligibility.sql`: adds three disabled programmes and empty reviewed-roster eligibility; wraps the current lineup/read projections. No ownership, scores, historical rules or existing round opt-ins are changed.
2. `20261031123931_member_google_test_receipts.sql`: empty expiring admissions and private receipt/event/outbox tables; role/session/MFA/RLS checks. No wallet updates or admission grants.

Both passed the migration suite. Apply once through tracked migration history after checking the target's backup/recovery state and current wrapper definitions. Do not replay the already applied `20261031094324` isolated-acceptance migration. For a rollback, keep the gates off and restore the prior application if required; retain receipt/audit history and never roll back customer wallet data.

For supervised TEST acceptance, securely configure `DOCKED_STORE_REFERENCE_KEY`, `DOCKED_STORE_ACCOUNT_BINDING_SECRET`, `DOCKED_GOOGLE_SERVICE_EMAIL`, `DOCKED_GOOGLE_PRIVATE_KEY` only on the server. Turn on `DOCKED_MEMBER_GOOGLE_TEST` only for the approved protected environment and provision an expiring admission for an explicitly authorised synthetic/test member and the exact approved two product/version allocations. No service credentials enter Android or browser bundles. Do not grant a normal customer merely to make the test pass.

Use a Google license-test account and native product allowlist, recheck that Google clearly says no charge, then prove purchase → wallet → same-sport pack → nine/three/one-card issuance → refresh → refund → consumed-purchase reconciliation. Inspect ledger, ownership and outbox before/after. Test refund after spending with isolated funds; obtain the commercial policy decision before allowing this behavior with real money. Configure and verify the durable reconciliation worker/RTDN hosting before paid activation; no automatic live worker is enabled here.

For free play, review current eligible player/position evidence and rights, populate the existing-identity roster with source hashes/expiry, opt only suitable new/editable no-prize test rounds into `public-free-core-v1`, and enable the selected programme. Then verify a fresh ordinary account's complete invite/confirmation/security → PLAY → Core selection → draft → entry journey. Public signup and any future broad activation remain a separate approval. Do not use fictional rosters as public professional players.

## Exact remaining owner/external actions

1. **Dedicated reviewer identity:** nominate a monitored email, complete its normal account confirmation and secure credential setup, and provide a reviewable security flow. Follow [reviewer instructions](GOOGLE_REVIEWER_ACCESS_20261101.md). Browser security requires the owner to enter a new credential; do not share the personal owner account or bypass MFA.
2. **Device/test window:** connect an Android device using the authorised Google license-test account. Confirm the exact isolated Docked test identity and temporary product-test window. Products remain inactive now; any new temporary activation must preserve the no-real-payment constraint and be reversed after acceptance. The previous operator-ledger test is insufficient for the new member route.
3. **Commercial model/rights:** approve the permitted player/card/statistics use, purchased-credit provenance and trading model, spent-credit refunds, consumer notices and legal/platform assessment of randomised paid cards plus scoring benefits. Do not convert beta credits/cards into commercial assets.
4. **Policies:** approve publication-ready privacy, refund, deletion, commercial and moderation rules; processor/overseas disclosures and retention schedule. Existing live beta terms still say NFL-only, allow swaps and omit multipliers. Publish a new immutable policy version, preserving historical consents. Complete isolated public-mode deletion acceptance; the shared beta identity is intentionally not automatically erased.
5. **Console declarations:** privacy URL, app access, content rating, target audience, Data Safety and financial features remain incomplete. Complete against the final enabled configuration, including WebView/server data and user-generated content. Review the new AI-asset declaration against actual artwork provenance. Listing currently truthfully describes invitation-only test operation and must be revised only when public paid functionality is verified.
6. **Final release approval:** after hosted acceptance, approve the exact release/version, Australia availability, public registration, products and store submission. Public release, real-money purchasing, withdrawals and prize activation have not been authorised by this continuation and remain disabled.

These are substantive launch blockers, not a claim that the release is compliant because code compiles. Google requires account deletion rather than only deactivation ([account-deletion guidance](https://support.google.com/googleplay/android-developer/answer/13327111)); Data Safety must include actual app/WebView/server processing ([Data Safety guidance](https://support.google.com/googleplay/android-developer/answer/10787469)). No legal or Google approval is inferred.

## Screenshots and evidence

- [Play listing ready for review, not submitted](qa/public-launch-final/play-listing-ready-review.jpg)
- [Genuine hosted NFL Game Day read-only check](qa/public-launch-final/hosted-nfl-play.jpg)
- [Isolated member Google TEST panel after verified synthetic receipt](qa/public-launch-final/member-google-synthetic-wallet.jpg)
- [Isolated AFL Core entry, 22 players / $11m](qa/public-launch-final/free-core-afl-summary-390.jpg)
- [Isolated NRL Core entry, 13 players / $6.5m](qa/public-launch-final/free-core-nrl-entered-390.jpg)
- [Real PostgreSQL concurrency evidence](qa/public-launch-final/store-pack-postgres.json)
- [Protected candidate access checks](qa/public-launch-final/candidate/candidate-http.json), [store/mobile/NBA gate checks](qa/public-launch-final/candidate/store-gates.json)

Engineering: gated candidate ready for supervised acceptance. Commercial: NO-GO pending rights/policies and actual member checkout/refund proof. Public Production release: NO-GO pending final owner approval and the checks above.
