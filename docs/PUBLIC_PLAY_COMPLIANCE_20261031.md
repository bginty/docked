# Australian public Play readiness — current review packet

31 October 2026. Draft for owner/legal/privacy review, not a submitted declaration or Google approval. This supersedes the old sports-analysis and NFL-only product descriptions for the proposed release; it does not amend accepted historical policy versions.

## Actual candidate scope

Ginty United Investments Pty Ltd operates Docked. Customer-visible sports are NFL, AFL and NRL. NBA data and engineering remain preserved but customer navigation and native routes exclude it. One account, shared test-credit balance, owned cards, random packs, credit-only marketplace, fantasy teams/rankings and moderated social features are present. Marketplace seller fee is 5%, capped at 2,000 credits, not the older 7.5% proposal. Offers/swaps are disabled.

Version 25 / 1.24 targets Android 36, minimum 24. The native shell serves authenticated `https://docked.com.au/app`; declarations must cover that remote content, not merely the APK. Native assets contain no QA launcher or local test certificate. No new advertising or crash-reporting SDK was added. Existing Google Play vitals are not a substitute for completed device acceptance.

Normal purchase allowlists are empty. Payments, withdrawals, cash prizes, public registration and permanent commercial issuance are not approved/activated by this candidate. The two owner-approved draft products are A$49 for 4,900 credits and A$99 for 9,900, without bonuses. Genuine license testing is isolated from customer wallets. A successful no-charge test does not approve public commercial use.

## Declaration evidence and unresolved decisions

| Topic | Source-backed finding | Remaining release action |
| --- | --- | --- |
| Accounts | Supabase Auth, verified email, profile/admission and applicable MFA; shared across sports | Dedicated ordinary reviewer account and repeatable access instructions; do not supply owner credentials or bypass MFA |
| Personal information | Email, user IDs, profile details, consent/security records; self-attested age and jurisdiction | Confirm required/optional purposes, processor locations and current retention schedule |
| Social | Posts, comments, reactions, follows, blocks, reports, moderation and optional media | Include UGC and media in rating/Data Safety; verify operational moderation and appeals; do not declare no social content |
| Game and transactions | Ownership, serials, pack openings, marketplace sales, lineups, competition scores and audit history | Declare applicable app activity/purchase history; distinguish test credits from cash |
| Analytics | `AnalyticsObserver` and `/api/analytics` use bounded first-party events after consent | Confirm actual hosting/security logs and provider retention, including remote WebView pages; do not claim no collection |
| Payments | Proposed ordinary digital credit bundles; Google handles checkout payment instrument, server receives purchase references/status | Ordinary Billing eligibility for the exact card/resale/prize model requires classification; tax treatment and refund-after-spend policy remain unresolved |
| Identity | Synthetic-only KYC workflow; no approval to collect real documents | Do not advertise real KYC readiness or include actual ID collection in this release |
| Device permissions | Candidate declares INTERNET, ACCESS_NETWORK_STATE, VIBRATE, BILLING and a signature-only internal receiver permission | No contacts/SMS/location/microphone permission added. Review optional image/camera interaction and remote content accurately |
| Deletion | `/account-deletion` points to authenticated `/dashboard`; `/api/member` requires confirmation and disables account before erasure/retry | Verify end-to-end on disposable authorised accounts, including the correct beta/Auth subject and retained ownership records; never use a real customer deletion for acceptance |
| Privacy publication | Existing policy packet still describes an earlier NFL-only beta; it does not accurately describe the whole current product | New version and owner-approved retention/processor statements required before publication/consent or Data Safety submission; do not overwrite historical accepted bytes |
| Store content | Public listing/content review remains incomplete; Console still labels internal app unreviewed | Finish reviewer access, truthful IARC, audience, Data Safety/financial features, listing and policy URLs. Do not guess an awarded rating |
| Commercial rights | Public roster availability is not commercial player-card/data permission | Establish applicable player identity, roster/statistics and artwork rights; generic jerseys alone do not settle all rights |

## Current official policy checks

Reviewed 31 October 2026:

- [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738): digital-goods purchases generally require Play Billing, subject to the stated exceptions/programs. Random-item odds must be disclosed close to purchase. P2P payments and gambling content are excluded uses of ordinary Play Billing. Existing PayPal links must not provide an unapproved in-app alternative checkout.
- [Payments explanation](https://support.google.com/googleplay/android-developer/answer/10281818): virtual currency is a digital item; a WebView is not an exception to the policy.
- [Real-money games/contests](https://support.google.com/googleplay/android-developer/answer/9877032): paid participation, including purchased items, to obtain real-world value can trigger restrictions. Eligible regulated models have separate requirements and must not use ordinary in-app Billing. This is a classification gate, not a determination that Docked is approved or prohibited.
- [Account deletion](https://support.google.com/googleplay/android-developer/answer/13327111): applicable apps need an in-app deletion path and a web request resource. Retention exceptions must be described honestly; a support link or UI existence alone does not prove erasure.
- [Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469): declare actual app and SDK data practices, including the remotely served member experience.
- [Secure Billing](https://developer.android.com/google/play/billing/security): authoritative server verification and replay protection remain necessary; client success alone must not credit a wallet.

## Concrete decisions before public release

1. Confirm the proposed public commercial model: nonredeemable digital credits only, or any redeemable seller proceeds/prizes. Obtain classification and rights review for the exact model. Keeping those features off does not authorise turning them on later without review.
2. Approve a truthful new privacy/terms/community packet, retention/deletion schedule, processor disclosures and operational moderation arrangements. Existing policy mismatch must be resolved before public onboarding.
3. Supply/authorise a dedicated reviewer account and supported access process. Reviewers need normal member features, not owner/staff access.
4. Complete the corresponding Console declarations and Australian listing after those facts are settled. No legal certification or agreement is inferred from test success.
5. Before any payment activation: approved Google products/tax treatment; production customer-account receipt binding; authenticated RTDN and durable reconciliation/voided-purchase recovery; spent-credit refund policy; monitoring and incident ownership; final store/legal/owner approval. The hosted operator test service intentionally cannot perform customer settlement.

Public release, public registration and payment activation are separate decisions. All remain disabled. No payment agreement, legal declaration, live deletion or public rollout was performed in this continuation.
