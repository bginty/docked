# Docked commercial launch — owner/legal review, 1 November 2026

**Not published terms, a legal opinion or an approval. Payments remain off.** The current invitation-only app and its test-credit policies remain in force. This document concerns the proposed Australian paid-pack release only.

## Recommended launch configuration

NFL, AFL and NRL; verified adult Australian accounts; free Core gameplay; optional paid Standard/Premium packs; Google Play Billing for Android credit purchases. Keep NBA, cash redemption/withdrawals, paid entry and prizes disabled. Keep commercial card transfers disabled initially, pending a written assessment of the secondary-market model. Preserve the existing private-beta market and records; do not represent beta inventory as purchased permanent property.

The proposed paid catalogue remains A$49 → 4,900 credits and A$99 → 9,900 credits, with no bonus. Packs remain Standard 1/3/9 for 100/300/700 credits and Premium 1/3/9 for 700/1,900/5,000 credits. Core is excluded from paid packs. No expiry, investment return, resale value or cash conversion is promised.

This recommendation preserves paid packs and free participation. It is **not an assertion that disabling cash-out alone makes every model compliant**. Permanent card/player rights, secondary-market value, competition benefits and the full linked service need review together.

## Google Play and Australian assessment

| Issue | Verified requirement / implication | Release action |
|---|---|---|
| Digital credits and packs | Google's Payments policy requires Play Billing for ordinary in-app digital purchases, limits virtual currency to the same app title, and requires clear prices and random-item odds near the purchase. It also excludes certain peer-to-peer/auction and gambling payments. | Use Play Billing, no PayPal steering in Android; assess the marketplace separately. Display odds at purchase review, with the unchanged failure-on-exhaustion rule. |
| Fantasy and valuable prizes | Google's gambling/contests rules restrict paying or staking money/in-app items to obtain real-world-value prizes outside its approved routes. DFS permissions cannot be inferred from an ordinary Billing integration. | Free entry and no prizes; do not enable valuable rewards on a flag alone. Seek a written Docked-specific assessment before linking paid cards to valuable competitions. |
| Random packs | Randomness alone is not a determination that a service is gambling. ACMA has specifically identified secondary markets as a factor making loot-box analysis less clear. | Assess consideration, chance/skill, value, transferability and state/territory rules; no blanket “not gambling” claim. |
| Australian classification | Australia's classification changes establish a minimum M for games with purchases linked to chance; simulated gambling has different treatment. An 18+ target-audience selection does not itself establish a rating. | Ensure IARC accurately discloses purchasable random items; confirm the actual resulting classification before public distribution. |
| Consumer rights | Online/mobile games are subject to Australian Consumer Law. Descriptions, prices and access must not mislead. | No “all sales final”, no exclusion of mandatory remedies, no guaranteed returns or invented scarcity. Support must assess statutory remedies even after opening/spending. |
| Privacy and deletion | Security, minimisation and justified retention apply to identifiable and pseudonymous records. Retention is not justified merely because a ledger is immutable. | Approve retention periods/bases and provider locations; retain only justified evidence after account erasure, with restricted access. |
| Player/data rights | A technically accessible roster or statistics API does not establish merchandising, name/image, database or commercial display rights. | Approve rights for each sport/catalogue and data source before permanent issuance. No logos/photos are added by this work. |

Primary sources checked 1 November 2026:

- [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play real-money gambling, games and contests](https://support.google.com/googleplay/android-developer/answer/9877032)
- [Google Billing security](https://developer.android.com/google/play/billing/security) and [one-time purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle/one-time)
- [ACMA evidence on online gambling and secondary markets](https://www.acma.gov.au/sites/default/files/2022-12/Sub-96-Australian-Communications-and-Media-Authority.pdf), pp. 9–10. This is general regulatory evidence, not an approval of Docked.
- [Australian classification changes](https://www.classification.gov.au/about-us/media-and-news/news/new-classifications-for-gambling-content-video-games)
- [ACCC: online and mobile games](https://www.accc.gov.au/consumers/advertising-and-promotions/online-and-mobile-games)
- [OAIC APP 11 guidance](https://www.oaic.gov.au/privacy/australian-privacy-principles/australian-privacy-principles-guidelines/chapter-11-app-11-security-of-personal-information)

## Proposed customer refund wording

You can ask Google Play or Docked support for help with a purchase. Contact support@docked.com.au and provide the order reference if available; never send a password or full payment-card details. Your rights under Australian Consumer Law are not excluded by these terms or by opening a pack.

When Google confirms a full refund, Docked removes the unused credits from that purchase. If those credits have already been spent, we may temporarily restrict further purchases, spending, pack opening and trading while support reviews the transaction. Free gameplay and access to help are not automatically blocked by this payment review. The app does not create a negative spendable balance, demand repayment automatically, or confiscate another member's cards. A restriction is not a determination that you acted improperly.

Partial refunds or inconsistent provider records require review. Docked will explain the outcome and applicable remedy. Receiving a refund does not silently delete transaction or ownership history. Support can release a completed-refund recovery hold with an audited reason; this does not itself transfer money or issue new cards. Approve the exact scope, review/appeal process and staffing before publication.

## Proposed digital purchase conditions

Docked Credits are digital units for eligible Docked features, not bank deposits, cash or an investment. Under the proposed launch configuration they are not withdrawable or redeemable for money. Google displays the final local price before checkout. Pending or cancelled payments do not add spendable credits. Purchases are bound to the signed-in Docked account; changing accounts does not transfer a purchase.

Packs contain the stated number of random player cards. The review screen must display the current price, per-card rarity probabilities, excluded rarities and supply restrictions. Core cards remain available for free gameplay. Limited cards use their existing lifetime supply and serial rules; a new season does not reset supply. A pack with insufficient eligible supply fails atomically, with no credit debit or substituted rarity policy. No real-player commercial catalogue is activated by this document.

Ownership means the recorded contractual right to use the digital collectible within Docked, subject to the approved service terms. It is not copyright in a player, club or league, a security, or a promise of resale value. Legal review must settle the precise licence, service-closure remedies and transfer terms.

## Proposed marketplace and competition conditions

Commercial trading starts disabled. If separately approved, credit sales use the existing 5% seller fee, capped at 2,000 credits, with whole-credit rounding (.5 upward). Buyers pay the listing price. No offers or swaps are reintroduced. Existing historical fees are not rewritten. Trading does not create a withdrawal entitlement.

Free Core entry remains possible without paid packs. Saved competition rules govern formation, eligibility, salaries, lockout, scoring and rarity multipliers. Rules and historical results are not changed by payment events. Proposed launch competitions have no paid entry and no prizes; the configured future prize proposals remain inactive.

## Proposed privacy and retention addendum

Google processes checkout payment details. Docked receives and verifies purchase references, product/order information, payment state, region, amounts and refund state; it does not receive your full payment-card number from this integration. Purchase references are encrypted on Docked's server and are never placed in browser storage or logs. Account, credit, pack, ownership, support and security records are used to deliver purchases, prevent duplicate fulfilment, reconcile refunds and resolve disputes.

Google notifications authenticate server-to-server delivery; notification messages alone never award credits. Docked uses its existing Supabase/PostgreSQL and Vercel infrastructure. The final public privacy policy must name the actual legal entity/contact, service providers and relevant overseas handling, and explain access, correction, complaints, deletion and legally justified exceptions.

Account deletion removes access and follows the existing erasure workflow. Minimal order/ledger/ownership/audit references may remain where a documented legal or operational basis requires them. A retained stable member identifier is **pseudonymous**, not anonymous. Receipt-token decryption access must end when the approved refund/reconciliation retention period ends, subject to documented holds. Do not claim a cleanup schedule has been activated: **no new retention period or destructive cleanup is approved or running**.

Before commercial activation the owner and adviser must specify retention periods, lawful bases, review/hold/release procedures, provider backup handling and a deletion schedule for receipt secrets, queue payloads, financial evidence, ownership history and support notes. The current immutable ledger design needs an approved archival/minimisation procedure; it does not authorise indefinite retention.

## Approvals still required

1. Legal/commercial model, Australian classification and any Google-specific permissions for the complete product, including transferability.
2. Real player/card/statistics rights and an audited lifetime-supply baseline; no duplicate permanent serial programme.
3. Published commercial Terms/Privacy/Refund/Retention versions and customer consent changeover.
4. Recovery-hold support policy, staffing, appeal/remedy process and financial settlement reporting.
5. Production migration/runtime grants, commercial-capable Android candidate acceptance, final checkout activation and Australian public submission.

The owner’s product contents approval does not substitute for these approvals. No legal attestation or public submission was made by the agent.
