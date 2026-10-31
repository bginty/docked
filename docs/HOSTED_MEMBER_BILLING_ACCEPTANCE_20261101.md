# Google Play hosted member-engine acceptance — 1 November 2026

Genuine Google Play TEST purchases, delayed approval, hosted wallet settlement, pack issuance and refunds have now passed on the physical Samsung. Android **27 / 1.26** is available to the existing internal testers and installed through Google Play. Public paid launch remains **NO-GO**. NBA, normal payments, public registration, withdrawals and prizes remain disabled.

This supersedes the hosted-billing blocker in the earlier 96e7fcdd/f3b50b45 reports. It does not supersede the outstanding commercial, reviewer, customer-authenticated deployment or public-policy requirements.

## What actually ran

The owner-authorised temporary environment reused the existing Vercel Preview project and a separate `store_member_acceptance` schema in the existing Supabase project. No new service plan, recurring paid resource, customer account or permanent inventory was created. The fixed synthetic member started with zero credits. Its identity was bound server-side to the Google receipt using HMAC; callers could not select a customer account or credit amount.

The Android TEST activity used a pinned-TLS USB transport. Receipt verification, shared member-wallet settlement, pack purchases, issuance, opening history and refunds ran in protected Vercel/Supabase, not a local wallet. The `MemberStoreTestPurchases`, `StoreTestInbox`, credit ledger and existing pack engine were reused. All roster/card records were labelled synthetic and non-permanent; there was no NBA pool.

This was a private paired synthetic identity, **not a fresh Supabase-authenticated customer checkout**. The native test screen displayed issued cards and history; it did not replace acceptance of the ordinary customer wallet/reveal interface. Those boundaries matter when assessing public readiness.

| Physical/hosted sequence | Actual result |
| --- | --- |
| Play-installed test build | Version 26 / 1.25-billing-qa, `docked.fantasy`, Samsung SM-S921B; installer `com.android.vending`. Initial install propagation/protection issues were resolved through Google Play, without uninstalling or clearing account data. |
| 4,900-credit product | Genuine A$49 **test** checkout using Google's slow-approval test card. PENDING credited zero; later server verification credited exactly 4,900. Google explicitly said no charge. |
| Refund before spending | Google order became CANCELLED; balance and spendable funds returned to zero. |
| 9,900-credit product | Genuine A$99 **test** checkout using Google's always-approves test card; server credited exactly 9,900. No real payment method. |
| NFL Standard 9 | Explicit purchase/open on device: 700 credits, nine synthetic NFL cards. |
| AFL Premium 9 | Explicit purchase/open on device: 5,000 credits, nine synthetic AFL cards. |
| NRL Standard 9 | Explicit purchase/open on device: 700 credits, nine synthetic NRL cards. |
| Resulting inventory | Three opened packs; 27 cards with sport, rarity and isolated serial/ownership records; remaining balance 3,500. |
| Concurrent replay | Four real-receipt replays and twelve pack-command replays caused no extra credit, debit, entitlement or card. State revision/hash stayed identical. Forged funding and access to the customer schema were denied. |
| Refund after spending | Second Google order became CANCELLED. Spendable funds became zero. The 3,500 recorded balance is held for recovery review; it is **not** reported as recovered cash or a cleared balance. The 27 issued test cards/history remain auditable. |
| Refund retry / spending hold | Both terminal refunds retried successfully; no second reversal. New purchase with held funds rejected. Revision 10/hash remained identical. |
| Completion | Both receipts CANCELLED; two consumption jobs done; zero unsettled fulfilment jobs. |

No real customer purchase, balance mutation, inventory grant, team entry, account deletion, email or prize award occurred. Customer wallet state stayed revision **226**, hash **5f6b1926b820cb90f68d9a6a01ab5d5e**, before provisioning and after all tests. This verifies the inspected aggregate and runtime isolation; it does not claim every customer table was exhaustively replayed.

## Deployment, shutdown and Android build

- Genuine checkout/pack/refund acceptance ran on `dpl_DmPXTgRXbCMfwwE9WhqiNe54DmQF`, `https://docked-preview-hp1hvby9l-briant-s-projects.vercel.app`.
- Final refund-retry fix ran on `dpl_86hhbhdcpZ9Uxo3JYPF2t4ATFyep`, `https://docked-preview-ntysakqo4-briant-s-projects.vercel.app`. READY verified; no Production alias changed.
- Fixed terminal-refund lookup: a cancelled receipt remains available for a safe retry, with its original member checked and Google reverified. Previously the active-receipts list excluded it after a lost success response.
- Both Australian Google purchase options were **deactivated** after testing. Publisher API independently reports INACTIVE for both.
- Temporary DB role is now **NOLOGIN**, request allowance exhausted, USB listener stopped and ADB reverse removed. Original test audit/history retained; no destructive cleanup.
- Normal app **v27 / 1.26** has no QA activity or local test certificate. It was released only to the existing internal track at 10:16 Sydney and installed from Google Play on the Samsung. Existing signed-in session opened successfully with NFL/AFL/NRL and no NBA selector. No repeat gameplay mutations were performed.
- Package `docked.fantasy`; min SDK 24, target SDK 36; production HTTPS origin `https://docked.com.au/app`. Debugging, cleartext and mixed content disabled. Normal payment product allowlist remains empty.
- AAB: `artifacts/android/Docked-public-candidate.aab`; SHA-256 **3e76cd5e0f0c15f7bcdc02b339d088ac3998a07f05233fa4b0188efe6f0d594e**.
- Google signing SHA-256: **64:F8:4E:E6:33:3C:E0:FE:7A:E3:08:A3:81:B0:9B:BF:AA:C0:2A:E6:EA:5A:CD:47:68:91:9C:E0:BC:DD:28:F1**. Generated v27 APK readback succeeded.
- Console warnings: missing deobfuscation map and native debug symbols. No blocking upload error. They remain diagnostic-quality limitations, not silently treated as resolved.
- Customer site remains commit **673a751b2ec755836ef31dfb9b967786861c7b99**, deployment **dpl_2cdQMeCTvRaX6dPSfoxuAF6SsBA9**. New server functionality was not promoted to docked.com.au.

## Migrations and recovery

| Migration | Status / impact |
| --- | --- |
| `20261031224322_isolated_member_billing_acceptance.sql` | Applied once to the separately secured test schema under the owner's isolated-hosted authorization. Creates only synthetic state/history/receipt/outbox/control tables and role access. No customer migration or admission. Ledger-managed one-time DDL: do not reapply manually. |
| `20261031123611_free_core_gameplay_eligibility.sql` | Prepared and previously verified against disposable PostgreSQL; **not applied to Production**. Disabled programmes; no ownership issuance or historical rules rewritten. |
| `20261031123931_member_google_test_receipts.sql` | Prepared and previously verified against disposable PostgreSQL; **not applied to Production**. Opt-in TEST admission only; real receipts rejected. |

The two customer migrations remain subject to explicit Production approval. Their prior compatibility/idempotency/deletion acceptance is documented in `ANDROID_DEVICE_ACCEPTANCE_20261101.md`. No duplicate replacement migration was created. Recovery for this test was shutdown, not rollback/deletion of the financial audit. Any future test reactivation must retain encryption keys and receipt history, use an expiring restricted login, and deliberately provision a new bounded test window; never reset/reseed the existing aggregate.

## Checks actually executed in this continuation

| Check | Result |
| --- | --- |
| Full platform suite | 688 passed, 0 failed/skipped. Includes NFL/AFL/NRL and existing NBA regressions. |
| Full database suite | 226 passed, 0 failed/skipped. |
| Final targeted native/hosted/member-pack checks | 31 passed after the latest changes; includes the added HMAC-bound synthetic subject test and all 18 pack variants. Overlaps the full suite; not 31 additional unique tests. |
| Disposable real PostgreSQL | Eight checks passed: dedicated RLS isolation; 20 receipt retries; 12 outbox consumers; 16 pack-purchase retries; ten opening retries; immutable journal/truncate denial; pending/refund/cross-member guards. Zero Production connections in this run. |
| Genuine hosted replay and refund audit | Passed with the actual Google TEST receipt references. No unbalanced journals; no duplicate state change. |
| Typecheck and lint | Passed; rerun after final scripts. |
| Android signed builds | v26 and v27 built successfully; v27 414 Gradle tasks, 55 executed; native lint included. |
| Packaged security | v27 pattern scan passed; QA launcher/certificate absent, HTTPS-only, no debug/mixed-content. This is not a penetration-test claim. |
| Physical v27 update | Google Play update completed; package readback code 27/name 1.26/Play installer; existing session restored, visible sports verified read-only. |

Full test logs are local under `private-data/member-billing-*.log`. Compact result evidence and selected screenshots are in `docs/qa/hosted-member-20261101/`. The attempted 9,900-checkout screenshot captured a loading spinner and is not presented as checkout proof; verified receipt/ledger results and observed native Google TEST selection support that test.

## Remaining blockers and exact actions

1. **Dedicated reviewer credentials/security:** use the already nominated reviewer email. It was absent from Auth on the earlier exact lookup. The owner must complete normal account confirmation and secure credential entry; no invented password or MFA exemption. Then genuinely test reviewer sign-in and enter those details in Console. Google currently blocks Target audience until Sign in details is completed. See `GOOGLE_REVIEWER_ACCESS_20261101.md`.
2. **Google notifications and persistent recovery:** Console's RTDN checkbox is off and topic empty. No authenticated Google Pub/Sub push was received in this test. The existing JWT validation/durable notification worker has isolated automated coverage; the hosted test reconciled through the protected server every 30 seconds while the temporary USB process ran. This is not a permanent scheduler. Confirm an authorised no-new-charge Pub/Sub topic/subscription, exact publisher/push-service IAM permissions and stable authenticated endpoint/worker before configuration; then test real notifications and missed-event recovery. Do not expand verifier permissions or enable billable infrastructure implicitly.
3. **Customer-authenticated end-to-end deployment:** approve the two prepared customer migrations and a bounded test admission/environment. Then test the ordinary signed-in wallet and reveal path with that exact configuration, including public-mode onboarding/deletion. Prior public-mode deletion acceptance used disposable PostgreSQL and a mock Auth service (11 checks/four concurrent requests), not deletion of a real hosted member. This private native harness does not substitute for those tests.
4. **Commercial model and policies:** approve player/card/statistics rights, purchased-versus-beta credit separation, marketplace transfer/redemption scope, spent-refund resolution, retention/processors and final privacy/refund/deletion/community texts. The four drafts in `docs/policies/2026-10-31-public-review/` remain unapproved. The existing adapter intentionally accepts TEST receipts only; commercial-money settlement requires the approved contract and acceptance, not simply a flag flip.
5. **Console:** Financial features saved for the current non-redeemable, payment-disabled game candidate. Four declarations still need attention: Privacy policy, Sign in details, Target audience, Data Safety. IARC/ads/advertising-ID/government/health and listing work from the prior turn were preserved. Review all declarations again against the final enabled commercial model. No public submission made.
6. **Final approvals:** approve the exact web/native release, commercial/payment activation and public registration separately after the above checks. Withdrawals and prizes require their own approval. NBA stays hidden.

Engineering TEST acceptance: **PASS within the stated isolated scope**. Ordinary customer/public checkout: **not yet accepted**. Commercial and public release: **NO-GO**.

## Evidence

- [Google no-charge slow TEST checkout](qa/hosted-member-20261101/google-4900-test-checkout.png)
- [Delayed pending / approved](qa/hosted-member-20261101/delayed-pending.json), [approved](qa/hosted-member-20261101/delayed-approved.json)
- [9,900 credit verified settlement](qa/hosted-member-20261101/instant-purchase.json)
- [27 cards and three opened packs](qa/hosted-member-20261101/packs-before-refund.json)
- [Hosted concurrent retries](qa/hosted-member-20261101/hosted-replays.json)
- [Final refund/hold audit](qa/hosted-member-20261101/final-refund-audit.json), [device result](qa/hosted-member-20261101/phone-spent-refund.png)
- [Products inactive](qa/hosted-member-20261101/play-products-inactive.jpg), [independent API readback](qa/hosted-member-20261101/google-v27-readback.json)
- [Internal v27 release](qa/hosted-member-20261101/play-v27-internal.jpg), [Samsung v27 signed-in app](qa/hosted-member-20261101/phone-v27-ready.png)
- [Temporary environment shut down](qa/hosted-member-20261101/hosted-closed.json)
