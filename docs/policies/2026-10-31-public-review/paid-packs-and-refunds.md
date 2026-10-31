# Paid packs and refund operations — owner review draft

NOT APPROVED OR ACTIVATED. This is the proposed operational and customer-disclosure packet, not legal clearance. No existing transaction, policy acceptance or customer entitlement is modified.

## Proposed purchase architecture

Use the two owner-approved account-wide Google Play consumables: A$49 / 4,900 Docked Credits and A$99 / 9,900, no bonus. The Google checkout displays its current localised price; do not derive an AUD checkout price from client credit arithmetic. After verified fulfilment, the existing account wallet buys a selected NFL/AFL/NRL pack. This preserves the shared wallet and existing pack, coupon, supply and ownership services.

Direct Google pack SKUs are an alternative, not a parallel implementation. They require approved AUD prices for 18 products, refund-to-card entitlement mapping, coupon decisions and store administration. None of those prices has been approved. Both architectures use Play Billing for Android digital goods; neither escapes fantasy/real-value policy restrictions or provider fees. No fixed Google fee percentage is assumed: enrolment, programme and actual settlement determine the applicable fee.

| Family | Cards | Docked Credits |
| --- | ---: | ---: |
| Standard | 1 | 100 |
| Standard | 3 | 300 |
| Standard | 9 | 700 |
| Premium | 1 | 700 |
| Premium | 3 | 1,900 |
| Premium | 9 | 5,000 |

Each sport uses its own authoritative product IDs. Core is excluded from paid packs. Premium has Ultra Rare, Legendary and Icon only. Exact configured per-card odds are displayed before confirmation. No guaranteed Legendary/Icon result is implied. Fulfilment fails without charge/substitution when the configured draw cannot be supplied; do not invent a fallback or exceed lifetime supply. Successful-pack frequencies can be affected by supply failure near exhaustion.

Free Core gameplay remains a public-launch requirement. The present beta picker is owned-card-only; do not claim public unlimited free Core onboarding has passed until a separate public-mode eligibility path is implemented and tested without issuing collectible inventory.

## Refund handling proven in isolated fixtures

Google is authoritative for payment state. A signed notification is a refresh hint, not an amount, account or award instruction. Verify the purchase again server-side using its bound member and approved product. Never accept a client-provided amount, order owner or successful checkout callback as fulfilment authority.

- Pending/declined: no spendable credits or pack issuance.
- Unspent reversed purchase: reverse the purchased lot once.
- Partly/fully spent purchase: create an auditable recovery-review case and prevent further spending of the remaining refunded funding. No automatic negative customer balance, cash debit, unrelated-funds seizure or retrospective lineup edit.
- Opened, locked or transferred cards: retain ownership, serials, saved lineups and transaction history while the case is reviewed. Do not confiscate a buyer's card or replay an opening.
- Duplicate or stale events: do not award/refund again; terminal revocation cannot be revived by a stale purchased response.
- Outage/restart: retry the durable reconciliation job and consumption outbox. Consume only after wallet commit. Check expired worker leases and stuck jobs; keep redacted operational errors.

This describes tested safety behaviour, not an approved commercial recovery policy. The owner/legal adviser must decide the resolution process for spent refunds, customer notice and appeal, opening restrictions for refunded unopened packs, dispute evidence, and any permitted recovery action. Do not automatically collect debt, cancel historical entries or claw back a third party's property.

## Customer wording for review

“Packs contain random digital cards. Review the card count, eligible rarities, chances and total price before you confirm. A higher rarity is not guaranteed unless the pack expressly says so. Core cards are available through free gameplay and are not included in paid packs.”

“For a Google Play purchase issue, contact support@docked.com.au and use Google Play's purchase support options. Do not send your password or full payment details. Refunds and remedies remain subject to applicable consumer rights; opening a pack does not by itself remove rights that cannot be excluded.”

Do not publish a blanket “no refunds” promise or imply that random content guarantees profit. Marketplace proceeds, competition rewards and purchased credits must have clearly approved transfer/redemption restrictions. Test credits have no cash value. Public paid credits must not be silently mixed with test funds or retroactively give old beta balances monetary value.

## Release prerequisites

1. Exact legal/platform classification for paid cards with scoring multipliers, marketplace resale and any prizes; commercial player/data rights.
2. Approved credit provenance and spent-refund policy; permanent issuance approval and available approved pools.
3. Customer-authenticated receipt adapter, public wallet mode/admission, durable hosted reconciliation, RTDN and missed-event recovery, monitoring and support tools. Existing local/hosted operator fixtures are not a customer billing endpoint.
4. Isolated public-mode signup → Google test receipt → wallet → both pack families → refund → deletion acceptance, including a genuine Android store-installed checkout.
5. Matching policies, Data Safety, IARC/rating, reviewer access and owner final activation approval.
