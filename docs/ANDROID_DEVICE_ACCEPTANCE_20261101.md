# Android acceptance — 1 November 2026 (Sydney)

Public launch remains **NO-GO**. Genuine physical-device read-only acceptance is now recorded; genuine Google checkout into the new member wallet is **not** complete. No paid product, public registration, NBA, withdrawal, prize or public release was activated. No production migration or customer mutation was performed.

This follows implementation `1dfe3239` and evidence `2394e136` on `codex/member-platform-updates`. Changes in this continuation fix public-mode account deletion and add reproducible migration/deletion acceptance. It does not duplicate the preceding wallet, pack or free-Core implementation.

## Physical Samsung evidence

The authorised Samsung **SM-S921B** was connected over ADB. Package `docked.fantasy` is genuinely installed by **com.android.vending**, versionCode **25**, versionName **1.24**. The active activity is `au.com.docked.app.MainActivity`.

The installed base APK's signature was verified and matches Google's generated-build signing certificate: `64f84ee6333ce0fe7ae308a381b09bbfaac02ae6ea5acd4768919ce0bcdd28f1`. Its packaged server URL is **https://docked.com.au/app**, not the staged server candidate. HTTPS is required; cleartext, mixed content, WebView debugging and logging are disabled.

| Actual device check | Result |
| --- | --- |
| Authenticated access | Existing owner session opened successfully. No fresh login or MFA challenge was completed; this is not reviewer-account acceptance. |
| Member wallet | 35,200 test credits; zero reserved. Balance remained the same across observed screens. |
| NFL PLAY | Week 7 rendered 105.81 PTS, 6/7 completed, rank 1 of 2. |
| AFL / NRL PLAY | Both sport selections rendered existing All-Star draft/test-round interfaces. No team was saved or entered. |
| NRL collection | Eight owned cards rendered, with jersey artwork and rarity badges. |
| NRL packs / history | Buy Packs and history rendered; two unopened starter entitlements were visible. Neither was opened. |
| NRL market | Browse, My Listings, Activity and filters rendered. No purchase, listing or transfer performed. |
| Visible sports | NFL, AFL and NRL; NBA absent. |
| Fresh restart/session persistence | Attempted, but the phone had locked. Owner unlock requested; not counted as passed. |
| Google TEST purchase / new wallet credit / refund | **Not executed** in this continuation. No Google checkout screen or licence-test payment method was asserted. |

Screenshots: [NFL](qa/android-device-20261101/nfl-play.png), [AFL](qa/android-device-20261101/afl-play.png), [NRL](qa/android-device-20261101/nrl-play.png), [wallet](qa/android-device-20261101/wallet.png), [cards](qa/android-device-20261101/nrl-cards.png), [packs](qa/android-device-20261101/nrl-packs.png), [history](qa/android-device-20261101/nrl-pack-history.png), [market](qa/android-device-20261101/nrl-market.png). No lock-screen/private wallpaper capture is included.

## Exact checkout blocker

v25 has an **empty native billing product allowlist** and loads the older live server. Both Australian Google options are still **INACTIVE** (`docked_credits_4900_v1`, `docked_credits_9900_v1`). Google API catalogue, signing and existing-refund readbacks succeeded, with zero API mutations; readback of an older refund is not a new refund test.

The new TEST-only member route requires the two unapplied migrations, isolated runtime credentials, normal confirmed identity/session requirements and an expiring server admission. Only the Production Supabase project is currently available; no authorised isolated hosted Auth/database target exists. The existing protected candidate still shares the Production database and has these gates off. It must not be called an isolated purchase environment or enabled against the owner's current wallet merely to pass a test.

Therefore there was no safe end-to-end checkout target for a replacement AAB. No redundant build was uploaded and no claim is made that v25 contains the latest server changes. After an isolated backend is available, prepare a version greater than 25 with the exact protected target and supervised TEST allowlist, install it through Play, verify the account and Google's explicit no-charge test method, and run the full purchase/open/refund/reconciliation journey.

The adapter deliberately rejects real-money receipts. Public paid launch also requires an approved production-money settlement/refund contract and its implementation; this is not a single feature-flag activation.

## Migration review and deletion corrections

| Migration | Impact | Application status |
| --- | --- | --- |
| `20261031123611_free_core_gameplay_eligibility.sql` | Adds disabled NFL/AFL/NRL programmes and empty, source-verified roster eligibility; wraps existing lineup/read projections. No collectible issuance, entry opt-in, historical rule change or ownership update. | Disposable PostgreSQL only. Not in Production history. |
| `20261031123931_member_google_test_receipts.sql` | Adds empty disabled admissions plus private receipt, immutable event and outbox tables. No grants to users, wallet updates or payment activation. Corrected transient admission FK to `ON DELETE CASCADE`; receipt/audit records are retained. | Disposable PostgreSQL only. Not in Production history. |

Public deletion previously had two defects: a transient store admission could prevent Auth erasure, and immediate successful erasure scrubbed a job payload without marking the job done. The service now requires a recorded matching deletion request, refuses active accounts, bounds the Auth request, serialises completion, marks the job done and records one audit under retries. The private-beta shared-identity safeguard is unchanged.

The isolated harness applies the existing migrations, seeds synthetic records, fingerprints **251 pre-existing tables**, proves transactional rollback of the two pending migrations, then records each version/hash once and skips a repeated tracked run. These SQL files are applied once through migration history; they are not claimed to be safe for arbitrary untracked SQL replay. Production application approval is still required.

Before any authorised hosted application: verify target/project, backup and restore availability, migration history and wrapper definitions; apply only the two missing versions; verify all programmes/admissions remain disabled and existing records match. Do not apply them to Production under this continuation's authority. After committed use, rollback means gates off and prior compatible application, retaining additive receipt/audit data. Do not drop populated history or restore a stale wallet snapshot over later customer activity.

## Executed checks

| Check | Actual result |
| --- | --- |
| Full platform suite | **688 passed**, 0 failed, 0 skipped. Existing NFL/AFL/NRL, NBA/scoring and store regressions included. |
| Full database suite | **226 passed**, 0 failed, 0 skipped. Repository migration/PGlite coverage. |
| Real PostgreSQL migration/deletion | **11 checks passed**, including forced overlap of four erasure requests, one completion audit, Auth outage recovery, no duplicate job and preservation of unrelated profile/wallet. Actual application service/runtime role; loopback mocked Supabase Auth transport. Not hosted Auth erasure. |
| Real PostgreSQL wallet/pack lifecycle | **5 checks passed**: 20 duplicate notifications, 12 workers, 16 purchase retries, 10 opening retries; nine cards issued once; receipt/account denial; pending, outage, lease recovery and spent-refund reconciliation. Google provider mocked; zero customer connections/charges. |
| Typecheck, lint, production build | Passed. Targeted lint rerun after acceptance-harness refinement. |
| Android audit | Existing signed v25 public-candidate audit passed; installed APK signing and actual manifest checked. No AD_ID permission or advertising SDK found. |
| Secret review | 32 staged files and 101 built browser assets scanned; no configured-secret matches. Six generic hits in two scripts reviewed as random loopback credential templates and the fixed mock Auth marker. No credential values emitted. |

Commands: `npm test`, `npm run db:test`, `node scripts/fantasy-production-local-postgres.mjs --launch-acceptance`, `node scripts/fantasy-production-local-postgres.mjs --store-pack-lifecycle`, `npm run typecheck`, `npm run lint`, `npm run build`, `python scripts/check-native-store.py --public-candidate`.

Initial migration/deletion tests exposed the admission FK defect. The stronger concurrency fixture also needed the actual SDK's versioned Auth-error response header; after correcting that fixture, four concurrent requests and all eleven checks passed. Earlier failures are not reported as passes. Evidence is under [android-device-20261101](qa/android-device-20261101/).

## Play Console and reviewer access

- Owner-approved IARC terms accepted and the truthful Game questionnaire completed. Digital goods, randomised pack items, marketplace capability and user interaction/moderation disclosed. No cash-convertible rewards or NFTs declared. This discloses purchase capabilities without activating them; re-review the answers if the final commercial model changes.
- Australian rating generated: **Mature**, with online interactivity/chat and chance-based in-game purchases. Console records the questionnaire submitted on 1 November; the app changes remain pending publishing review. This is not policy/legal approval or a public release. South Korea requires separate GRAC review and remains out of the Australian launch scope. Certificate ID was not yet populated.
- **Advertising ID: No** saved, grounded in the actual Play-installed APK permissions/dependencies.
- **Data Safety draft** saved with collection and encryption-in-transit answers. Detailed processing/retention and final public-policy declarations remain incomplete; no false “no data collected” claim.
- **Financial-features draft** saved as no financial features for the currently non-redeemable, payment-disabled game candidate. This is not a certification of a future cash/redeemable wallet or reward product. Reconcile it with the final owner-approved model before submission; no banking, money-transfer, investment or NFT feature was claimed.
- Dashboard reached **6/11** after content rating. Target audience is explicitly blocked by Google until Sign in details is complete. Other outstanding items: privacy policy, verified reviewer sign-in, Data Safety and financial-features declaration for the final enabled model.
- The owner nominated a dedicated reviewer email. Exact Production Auth lookup found no account. No credential was invented, normal email confirmation/MFA bypassed, invitation sent or reviewer permissions granted. [Prepared reviewer instructions](GOOGLE_REVIEWER_ACCESS_20261101.md) now use the nomination without asking again. Credential entry remains an owner handoff.
- Privacy, refund, deletion and commercial drafts remain in `docs/policies/2026-10-31-public-review/`. Technical deletion evidence added without claiming approval/publication. Existing accepted policy versions remain unchanged.

## Artifact and hosted state

Signed AAB remains `artifacts/android/Docked-public-candidate.aab`, version **25 / 1.24**, package `docked.fantasy`, SHA-256 **3656d9b88797f5bc9a8cbae1b29995717631b478cd7b31002228caaa900e0f85**. Its payment-disabled native configuration is not a checkout acceptance build.

Live [docked.com.au](https://docked.com.au) remains commit **673a751b2ec755836ef31dfb9b967786861c7b99**, deployment `dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9`. Prior protected candidate `1dfe3239` is [here](https://docked-production-c2a9tol2u-briant-s-projects.vercel.app); no alias promoted. This continuation's erasure fixes are local/committed, not deployed.

Production's shared test-wallet document remained revision **226**, MD5 **5f6b1926b820cb90f68d9a6a01ab5d5e**, before/after read-only checks. Both pending migration versions remain absent and the new admission table is absent. No account, inventory, competition, balance, refund or permanent-card mutation was performed. This does not claim every historical customer path was replayed.

## Remaining owner/external actions in order

1. Provide/authorise a genuinely isolated hosted Supabase/Auth test target and protected runtime configuration. No paid infrastructure should be created without approval. Alternatively explicitly review a narrowly isolated Production test plan and the two migrations; current instructions do **not** approve Production application.
2. Finish normal account creation/confirmation and secure credential entry for the already nominated reviewer identity. Provide a reviewable normal security flow; do not reuse the owner's session or remove MFA. Then complete Sign in details and Target audience.
3. Authorise a new supervised Google product-test window only after the protected backend and exact test identity are ready. Products remain inactive now. Build/install a newer TEST-capable internal release, then verify wallet credit, same-sport pack, ownership/history, refund/reconciliation and duplicate protection with Google test methods. No real payment method.
4. Approve accurate public privacy/refund/deletion/retention/commercial terms, catalogue/statistics rights and the complete random-pack/trading/scoring model. Complete Data Safety and financial declarations against that exact configuration, and implement/accept production-money settlement before any paid activation.
5. After full hosted acceptance, approve the exact public release, products and registration separately. NBA, withdrawals, prizes and cash features remain off unless separately authorised.

Engineering: reviewed candidate and isolated tests ready, but hosted member purchase acceptance blocked. Commercial: NO-GO. Public release: NO-GO.

Console evidence: [IARC saved](qa/android-device-20261101/iarc-saved.jpg), [Australian rating](qa/android-device-20261101/iarc-australia-rating.jpg), [advertising ID saved](qa/android-device-20261101/advertising-id-saved.jpg), [Data Safety draft](qa/android-device-20261101/data-safety-draft.jpg), [financial draft](qa/android-device-20261101/financial-features-draft.jpg). These declarations have not been sent as a public app release. Google's [financial-services policy](https://support.google.com/googleplay/android-developer/answer/18265346?hl=en) concerns money/cryptocurrency management and investment; the declaration must be re-evaluated if the enabled product changes.
