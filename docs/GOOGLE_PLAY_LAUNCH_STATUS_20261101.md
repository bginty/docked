# Docked Google Play launch status — 1 November 2026

**Public launch: NO-GO.** Scoped Google notification infrastructure is now deployed and genuine Google delivery is verified. Android v28 is available to the existing internal testers. Real-money products, public registration, withdrawals, prizes and NBA remain disabled. This report supersedes earlier notification-IAM and Android-version checkpoints; it does not erase their evidence.

## Completed in this continuation

- Applied the owner-approved topic-only Google publisher grant and keyless OIDC delivery identity. No wallet, release or administrator role granted.
- Saved authenticated Pub/Sub delivery and the exact Play Console topic, including one-time purchase/refund events.
- Observed a **real Google Console test message** in the private durable queue at 07:09:20 UTC, `test/done`. No purchase token or credit award. This is genuine delivery evidence, **not a real refund event**.
- Deployed the private TEST reconciliation runtime to https://docked.com.au. Application commit **de9508a767ea971f50c9238dc893844b54b589d3**, Vercel **dpl_D9qbsBbeHrjCAjAtdpTvsjaiAEyX**. Candidate: https://docked-production-n5yj6h2a0-briant-s-projects.vercel.app.
- Added one five-minute Vercel Cron on the already-active Pro account; no new paid subscription/host. Fixed a hosted-only rejection: Vercel's scheduler carries its deployment-protection cookie. The handler now tolerates only `_vercel_jwt` in addition to the independent secret, while denying member cookies, Origin and forwarded authorization. Existing POST and Google JWT protections are unchanged.
- Prepared and released **28 / 1.27-member-test** to internal testing. The existing v27 artifact remains unchanged. Native products are enabled only in the separate TEST build; server admission and Play products remain disabled. No ordinary member was granted purchase access.
- Verified the genuine signed-in reviewer's mobile-capabilities endpoint on the live backend: sports exactly NFL/AFL/NRL, billing false with no products, public registration false. Restored its Profile afterward.

Detailed evidence and rollback: [notification acceptance](GOOGLE_NOTIFICATION_ACTIVATION_20261101.md), [Android internal release](ANDROID_MEMBER_TEST_RELEASE_20261101.md), `qa/customer-billing-20261101/rtdn-verified-release/`, `genuine-google-notification.json` and `reviewer-live-mobile-capabilities.json`.

## Preservation and migrations

Wallet revision **226**, document hash **5f6b1926b820cb90f68d9a6a01ab5d5e**, unchanged from before this work. Ordinary Google receipts **0**, test admissions **0**. All nine existing database schedules, including NFL processing, retain their original command hashes/schedules. No purchase, opening, balance adjustment, prize or permanent card issuance was used to verify this continuation.

Previously approved migrations are all applied; no new migration was introduced for notifications or v28:

1. `20261031123611_free_core_gameplay_eligibility.sql` — disabled versioned gameplay eligibility, no collectible issuance/history rewrite.
2. `20261031123931_member_google_test_receipts.sql` — private TEST admission/receipt/consumption records.
3. `20261031234304_google_test_reconciliation_queue.sql` — private RLS queue, applied 06:15:48 UTC after separate approval.

Exact source/history checks, encrypted targeted recovery snapshots and twelve protected fingerprints were verified when applying them. They are not blindly rerunnable raw DDL. The backup is not a complete Auth/storage disaster-recovery backup. Suspend the notification runtime by promoting **dpl_FpXCzRPTNYFtK7DVTj5dAXW3PiYp** / **5a62f4ee**; preserve receipt keys, queues and audit records. Never restore a stale wallet snapshot over later activity.

The old release script's `privateNba:true` receipt field names shared beta infrastructure; customer NBA visibility remains denied. Copied commerce receipts are provenance from earlier work, not a new activation.

## Actual verification

| Check | Evidence/result |
| --- | --- |
| Initial notification/security/member tests | 17 passed |
| Follow-up HTTP/native-navigation tests | 11 passed; overlapping focused suites, not 11 additional unique scenarios |
| Final scheduler-cookie and Google-signature tests | 9 passed; valid secret required, forged/missing secret and mixed member cookies denied |
| TypeScript and targeted lint | Passed; final application built READY on Vercel |
| Final protected deployment HTTP checks | 8 passed |
| Final hosted HTTP/authorised worker health | 10 passed; zero pending/working/attention/overdue jobs |
| Natural five-minute scheduled worker | Passed at 07:30:09.812 UTC, independently of manual trigger; healthy empty queue |
| Genuine Google delivery | Persisted completed Console test message; no financial mutation |
| Signed-in reviewer backend capability check | NFL/AFL/NRL only; payments and registration disabled |
| Android AAB/APK, signing, archive security inspection | Passed; exact package/version/HTTPS origin, no configured server secrets/custom lab CA |
| Android lint | 0 errors, 34 resource/icon/manifest warnings |
| Play bundle validation/internal publication | Accepted; two advisory symbol/mapping warnings; Available to internal testers |
| v28 device purchase/refund | **Pending**; no device attached, not simulated as passed |

Earlier 1 November baseline remains applicable: **692 platform tests**, **226 database tests**, 12 disposable migration/deletion checks preserving 251 pre-existing fingerprints, and six disposable wallet/pack/refund concurrency checks (20 duplicate notifications, 12 workers, 16 purchases/10 openings). Those broad suites were not unnecessarily rerun for the narrow scheduler/native transport changes. PostgreSQL/provider mutation tests used disposable fixtures; they are not hosted customer checkout evidence.

No external operational-alert delivery has been verified. Attention counters are visible in existing Vercel logs. Inspection also found pre-existing broad pg_net queue access; this worker avoids it entirely rather than storing its secret there. Separate infrastructure hardening remains advisable. The prior Supabase leaked-password-protection warning remains unresolved; no RLS/authentication protection was weakened to dismiss warnings.

## Reviewer and Console

- Dedicated reviewer `briantginty21@gmail.com` completed normal signup, email confirmation, consent and password sign-in. Existing ordinary membership rows were repaired earlier without funds/cards/admin roles. Password remains owner-held.
- Real browser access to Profile, three Play formations, all 18 pack products, NRL Market and unified Social was observed. NBA and owner operations remain denied. No gameplay submission or purchase was performed.
- **Full reviewer access is incomplete:** no free-Core programme is enabled, the empty collection cannot build a team, and NFL currently resolves to closed Week 7. A verified eligible free-Core roster/round programme must be configured before attesting full access. Existing beta access deadline is 31 January 2027; review support must cover Google's actual review window.
- Console currently has **8/11 setup tasks completed**. Sign-in details, target audience/content and final Data Safety remain. Target audience is blocked until sign-in details are complete. The prepared login modal has an empty password and unticked full-access declaration; these were not fabricated.
- Privacy, financial features, advertising ID, content rating, health, government and ads declarations were previously actioned. Listing/category/contact setup is marked complete. These are saved declarations, not external commercial approval.
- Both Google products remain INACTIVE: A$49/4,900 and A$99/9,900 credits, no bonuses. No public Production track was submitted.

## Published policy versions

Published version **2026-11-01-release-preparation-v1**, source `config/launch-policy-content.json`:

- https://docked.com.au/privacy
- https://docked.com.au/refund-policy
- https://docked.com.au/retention
- https://docked.com.au/commercial-policy
- Existing deletion resource: https://docked.com.au/account-deletion

These describe the actual TEST service and identify proposed commercial terms. Existing accepted consent versions were preserved. Publication does not claim legal review or settle player/card/data rights, paid-random-pack/platform classification, spent-credit refund recovery/appeals or commercial retention obligations.

## Exact remaining launch work

1. **Ordinary customer TEST acceptance:** use v28 on an authorised Play licence-test environment, confirmed isolated member, bounded admission and temporarily enabled test products. Verify genuine checkout → correct member wallet → permitted pack/ownership → duplicate/delayed handling → refunds before/after spending, with actual refund RTDN/reconciliation. Current Console test delivery does not substitute for this. A Play-enabled device is required for the native boundary; do not repeat unrelated prior v27 tests.
2. **Reviewer gameplay:** configure a source-verified eligible free-Core roster and valid testable rounds without prizes or permanent issuance, within the already-authorised free-Core work. Current programme/roster configuration is absent; do not invent eligibility, fixture dates or rewrite closed historical rounds. Complete full access acceptance, then have the owner enter the existing reviewer password directly in Console and finish the truthful app-access declaration. Do not reset credentials or bypass normal security.
3. **Public-mode registration/deletion:** complete an isolated hosted end-to-end member acceptance using approved consent/age/territory configuration. Local public-mode deletion with mocked Auth passed; disposable hosted Auth deletion remains pending. Keep public registration closed meanwhile.
4. **Commercial approval:** resolve rights and Google/legal classification for the intended paid cards, rarity-based fantasy performance and marketplace model; approve the final refund/retention terms. Finish accurate Data Safety/target-audience declarations against that exact release configuration. Do not hide paid products from the long-term model or call TEST acceptance commercial acceptance.
5. **Final release:** use a newer public-candidate version code after v28 with separately reviewed features. Do not promote the member-TEST build publicly. Obtain the owner's final Australian submission/rollout approval; payments, withdrawals and prizes are separate approvals.

No permission to submit publicly or activate real-money purchases was exercised. The outstanding items above prevent an honest public-launch GO decision.
