# Hosted Google acceptance and Android 25

31 October 2026, Australia/Sydney. Public release and normal payments remain **NO-GO**. Internal testing is active. NBA remains hidden.

## Genuine Google results

Samsung SM-S921B, Android 16, Google license tester, Play-installed QA version 24. Each checkout visibly stated that it was a test order with no charge. Earlier terms and temporary-product-activation approvals were retained; no real payment method was used.

| Scenario | Observed hosted result |
| --- | --- |
| A$49 / 4,900 immediate approval | Exactly 4,900 credits, verified PURCHASED receipt and completed consumption job |
| Repeat reconciliation | Still 4,900; no duplicate credit |
| First refund | Google authoritative CANCELLED readback; test balance zero |
| A$99 / 9,900 immediate approval | Exactly 9,900, consumed once; refund returned balance to zero |
| A$49 delayed approval | Initially PENDING and zero; automatic reconciliation later credited 4,900 once and consumed |
| Delayed-order refund | Authoritative cancellation; balance returned to zero |
| Final readback | Three CANCELLED receipts; three completed consumption jobs; nine balanced journal operations, net zero; no pending orders |

This is real provider checkout with **hosted isolated settlement**, not customer-wallet acceptance. No customer wallet was connected to the test endpoint. The QA screen's old sentence saying “local ledger” is stale for this USB transport: all verification, consumption, refund and durable settlement ran on protected Vercel/Supabase. The normal public candidate contains no test screen. Immediate declines and delayed declines were genuinely tested in the previous local-ledger session, not repeated against this hosted service; fixture coverage also passes. Do not conflate those scopes.

## Infrastructure and preservation

- Applied migration **20261031094324_isolated_google_billing_acceptance** once; local filename matches actual Supabase migration history. It creates only `store_billing_acceptance`, its audit/inbox/outbox tables and dedicated RLS role. No customer, Auth or fantasy rows were updated.
- Existing customer `credits_sandbox` persistence was reused through an explicit trusted schema parameter, with its original schema and lock as the default. Isolated testing uses a different advisory lock, preventing unnecessary contention with ordinary gameplay.
- Runtime role `docked_billing_test` cannot use customer `credits_sandbox`; no superuser/BYPASSRLS. Receipt references are encrypted; runtime credentials stayed outside Git/client assets. Vercel protection was preserved, with an additional expiring secret, strict request boundary and durable request ceiling.
- Final protected deployment: `dpl_3QA431RgnprYB56X5QuLfkNgMKMV`, `https://docked-preview-rlbequfzr-briant-s-projects.vercel.app/api/acceptance`, Sydney. It is an operator-only test endpoint, not imported into customer Next routes. The ordinary Preview alias was restored to the preceding Preview application deployment after testing.
- Both Google AU options restored **INACTIVE**, verified by Publisher API at 21:13 AEDT and again after upload. Normal native allowlists remain empty; no public/payment/withdrawal/prize/registration flag changed.
- Test service shut down: dedicated role NOLOGIN, request budget exhausted, USB bridge stopped and its single forwarding rule removed. Encrypted test audit evidence remains; no destructive cleanup was performed.
- Customer aggregate revision **226**, hash `5f6b1926b820cb90f68d9a6a01ab5d5e`, exactly matched the pre-test baseline at closure. This supports unchanged customer wallet/inventory aggregate; it is not a claim to have audited every unrelated database row.
- Existing Production website still resolves to `673a751b2ec755836ef31dfb9b967786861c7b99`, deployment `dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9`. No Production application deployment occurred in this continuation.

## Android candidate and internal release

Signed AAB: `artifacts/android/Docked-public-candidate.aab`; package `docked.fantasy`, version **25 / 1.24**, min API24, target API36. SHA256 `3656d9b88797f5bc9a8cbae1b29995717631b478cd7b31002228caaa900e0f85`.

Google accepted this AAB, generated its distribution-signed APK, and version 25 is **Active / Available to internal testers**, released at 21:20 AEDT. Existing tester membership remains unchanged. It was not promoted to Production/public. Google estimates 7.82 MB new-install delivery and 923 KB update; these are Console estimates, not measured connection performance.

The candidate uses a distinct `storeCandidate` target and excludes QA sources, test certificate and second launcher. The signed APK asset scan passed; no cleartext/mixed content/debugging or secret markers found in packaged text assets. Gradle release build and Android lint passed. Google generated-APK certificate SHA256 matches `64f84ee6333ce0fe7ae308a381b09bbfaac02ae6ea5acd4768919ce0bcdd28f1`.

Google's installer protection blocked a manually installed signed copy from opening. Protection was not bypassed or disabled: version 25 was released to the authorised internal track, then installed via the phone's **Update from Play** control. Diagnostics confirm version 25 and installer `com.android.vending`.

Read-only signed-in acceptance confirmed session persistence, a normal single launcher, NFL Week 7 105.81 points/6 of 7 completed and the unchanged 35,200 test-credit balance. AFL and NRL Play render through sport switching. NBA is absent. No team, pack, marketplace or account mutation was used for customer acceptance. Initial stale QA-task loading was resolved by stopping only the app process; app data was never cleared. These observations are limited acceptance, not every gameplay/financial journey.

Further version-25 device checks rendered NRL Cards (eight owned cards), Packs with coupon input and Buy/My Packs/History controls, Marketplace Browse/My Listings/Activity, unified Social, and Profile. Profile matched Cards at eight NRL cards (all Ultra Rare), zero entries and one opened pack. Test Wallet displayed 35,200 test credits, zero reserved and explicit non-withdrawable/no-cash-value wording. Profile showed an intermediate loading screen before completing; no timed performance claim is made. No purchase, post, trade or profile edit was submitted. These screen checks do not establish transaction acceptance or all-sport inventory correctness.

Google reports two nonblocking diagnostic warnings: no R8 deobfuscation mapping (candidate is not minified), and no native debug symbols. Native CameraX utilities are precompiled dependencies; symbols have not been fabricated. Their diagnostic limitation remains documented for production crash analysis.

## Tests executed

- Hosted boundary, Google verifier and lab HTTP tests: **14 passed**.
- Native sport/release/product/auth guards: **5 passed**.
- Android build/packaging regression: **11 passed**.
- Dedicated-schema PostgreSQL integration: **7 checks passed**, including 20 concurrent duplicate purchases, 12 consumers, refund/stale replay, pending zero, cross-member rejection, RLS/customer isolation and immutable journal protection.
- Existing default-store PostgreSQL regression: **4 scenarios passed**, including rollback and outbox retry. Mutation tests used disposable local databases, not customer accounts.
- Full TypeScript and changed-file ESLint passed. AAB/Google-generated APK signature checks and native asset scan passed. These scoped checks are not a penetration test or a full all-sports mutation regression.
- Final changed-file ESLint and staged whitespace checks passed. A staged-text credential-pattern scan found only interpolated local fixture URLs and an explicit dummy `fixture` password in a test; no real credential was staged.
- Public read-only HTTP checks: privacy and deletion pages return 200; unauthenticated mobile capabilities return 401; private hosted acceptance redirects unauthenticated requests to Vercel protection. Published privacy still uses the older `2026-10-11-beta-rc3` packet and retention is still described as under review.

Evidence: `docs/qa/public-play-readiness-20261031/hosted-*`, `public-candidate-*`, `public-native-security.json`, `public-readonly-checks.json`, `internal-v25-active.png` and `v25-*`. No raw purchase tokens, order IDs or credentials are included.

## Remaining public-release gates

See [current compliance packet](PUBLIC_PLAY_COMPLIANCE_20261031.md). New privacy/retention/processor disclosures, rights and commercial-model classification, truthful Console declarations and a dedicated reviewer-access process remain required. The old NFL-only policy cannot truthfully cover the proposed public product.

Normal customer settlement is still disabled. This acceptance validates the shared mechanisms in an isolated hosted ledger; it does not validate authenticated customer checkout/crediting, production RTDN/voided-order recovery, refund-after-spend policy or live financial operations. Those need reviewed configuration and isolated end-to-end acceptance before payment activation. Public registration/release and real-money activation remain separate owner decisions.

No real charges, customer refunds, live prize awards, new NBA visibility, public rollout or legal-policy submissions were made.
