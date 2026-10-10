# Owner-supplied PayPal purchase buttons — 11 October 2026

The owner requests that people be able to buy Premium and Elite cards using the supplied PayPal Hosted Buttons. This authorises purchase integration; do not ask again merely for permission to add the buttons. Follow-up approval: **random selection from a disclosed pool; Premium = RARE**. Do not ask these decisions again. Sale inventory/supply, rights and unrelated cash trading, prizes or withdrawals are not approved by that answer.

## Saved configuration, not activated checkout

Exact public SDK client ID, button IDs and product mappings are saved in `config/paypal-hosted-buttons.json`. These are public embed identifiers, not a PayPal API secret. The amounts in that file are Docked's expected prices, **not independently verified PayPal product settings**.

| Docked product | Expected price / contents | Supplied button |
| --- | --- | --- |
| Premium Single-Card Pack | AUD49 / exactly one Premium card | K8BXZRS7V5Q2G |
| Elite Single-Card Pack | AUD99 / exactly one Elite card | EPY3GUUNWFMRN |

The configuration is deliberately not imported into the member page. `PackProducts` remains unavailable; no PayPal script, external checkout link or live purchase endpoint has been enabled. This is preparation, not a delivered payment integration. Changing the JSON status alone must never enable checkout.

## Concrete implementation findings

- `src/core/pack-products.ts`: Premium now maps to RARE and Elite to ELITE; both use random disclosed-pool selection. No existing card tier or score is changed. Tax treatment and paid rights/policy readiness remain unset.
- `src/server/commerce-sandbox-store.ts`: only a disposable loopback harness, backed by synthetic sandbox state. There is no hosted purchase/reservation/fulfilment path to attach these live buttons to.
- `src/server/paypal-sandbox.ts`: server-created Orders API orders and signed completed-capture verification, fixed to PayPal sandbox. It is not a verified Hosted Buttons integration. Do not assume Hosted Buttons transactions reach this app's webhook or contain its bound order IDs.
- Existing finite supply, ownership and exactly-once sandbox tests are useful foundations. They are not evidence that an external buyer can pay and receive a card on the deployed site.
- Existing beta cards are not commercial stock. Do not sell them, silently convert them, or mint outside approved permanent caps.

## Required owner answers

1. Which sport/player/edition pool is sale-ready, and what finite supply is approved? Preserve existing card identities and caps. Premium = RARE and random selection are already resolved.
2. Confirm actual total-price/tax treatment, delivery and refund terms, and the permitted paid use of the chosen card content. Prior approval of all-current players for a free beta does not itself establish paid card content rights.

## Random allocation foundation (synthetic sandbox only)

`random-order` accepts only product and payment method. The service selects using Node's cryptographic `randomInt` from deduplicated, existing, unowned, unreserved cards matching the product's sport and tier, inside the existing transaction/row lock. Each available card unit has equal chance; this is not necessarily equal probability per player if players have different available unit counts. Live disclosure must show the actual pool, selection distribution and available supply before confirmation, with a version-bound reservation/quote; that hosted disclosure flow is not yet implemented.

The order retains a private eligible-unit snapshot/hash, selected unit and timestamp. The pre-payment response withholds the selected card and allocation record; duplicate requests return the original result without another draw. Cancellation/expiry releases a reservation, never adds to lifetime supply; paid fulfilment retains the existing exactly-once checks. Named-card synthetic tests remain useful historical coverage but are not the approved paid offering. No live activation switch was added.

## Engineering activation work after product definition

1. Verify both PayPal dashboard products: merchant/payee, AUD49/AUD99, exactly one card, quantity controls, taxes/fees, inventory and description. Direct public page inspection did not return usable content in this review, so no merchant, amount or guest-card availability has been verified. In PayPal: **Pay & Get Paid → Create Payment Links and Buttons**, inspect each supplied product and Settings. Do not make real test payments.
2. Prove an authenticated Docked order-to-payment binding and finite reservation before allowing money collection. A shared hosted button alone does not provide Docked account attribution or reservation. Do not treat a payer email, browser success callback, return URL or screenshot as payment/ownership proof. If these static buttons cannot support the required binding, use the existing server-order architecture with PayPal Checkout rather than claim static embedding is equivalent.
3. Configure separate sandbox credentials, merchant ID and webhook ID server-side; connect signature verification, captured amount/currency/payee/order checks, exactly-once card fulfilment, immutable receipts and refund/dispute reconciliation. Credentials belong in scoped server environment settings, never chat or `NEXT_PUBLIC_*`. The public supplied SDK identifier does not establish availability of these credentials.
4. Run actual sandbox purchase/cancel/failure/duplicate-notification/concurrent-last-card and paid-but-unfulfilled recovery acceptance. Local mock results alone do not pass this gate.
5. Deploy to protected Preview for checkout review. Only then enable the approved sales flow in the intended admitted-user environment. Preserve the separate admission/domain readiness gates and all existing ownership, MFA and supply controls.

The current site CSP allows scripts/connects only from self and the Permissions Policy disables payment. Review a narrowly scoped checkout policy for the verified PayPal integration instead of broadly relaxing application security. Current policies remain unchanged.

## Executed local verification

- Nine commerce/platform cases passed, including approved tier/price mapping, random pool exclusions, hidden allocation, idempotent retry, cancellation, confirmed payment and fulfilment.
- Disposable PostgreSQL passed twenty competing random purchases of the last unit (one reservation), repeated payments/fulfilments, injected persistence failure rollback, private audit and untrusted-role denial. The same existing harness also checks sandbox withdrawals/prizes; none are activated.
- Typecheck, lint and production web build passed. These checks do not establish actual PayPal sandbox/live acceptance, hosted purchase readiness or physical Android behaviour.

## Official references checked

- [PayPal Payment Links and Buttons](https://developer.paypal.com/payment-links-buttons/overview): embed buttons/payment links are checkout entry points.
- [Button settings](https://developer.paypal.com/payment-links-buttons/customize/): merchant display, methods and return settings are managed in PayPal; actual method availability must be tested for this merchant/buyer context.
- [Payment Links API](https://developer.paypal.com/api/payment-links-buttons/): API-created payment links are a separate integration; current documentation says this API does not return button code. Do not substitute undocumented APIs for the supplied buttons.
- [PayPal Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate): server-created/captured orders offer the existing Docked sandbox architecture a supported integration path.

No PayPal settings, deployment, hosted database records, real inventory, charges or Android package were changed. The owner-supplied live buttons must not be loaded merely for an aesthetic Preview because they can collect real money.
