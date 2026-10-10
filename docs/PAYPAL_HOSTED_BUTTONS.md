# Owner-supplied PayPal purchase buttons — 11 October 2026

The owner requests that people be able to buy Premium and Elite cards using the supplied PayPal Hosted Buttons. This authorises purchase integration; do not ask again merely for permission to add the buttons. It does not define the missing sale inventory or selection method, certify rights, or authorise unrelated cash trading, prizes or withdrawals.

## Saved configuration, not activated checkout

Exact public SDK client ID, button IDs and product mappings are saved in `config/paypal-hosted-buttons.json`. These are public embed identifiers, not a PayPal API secret. The amounts in that file are Docked's expected prices, **not independently verified PayPal product settings**.

| Docked product | Expected price / contents | Supplied button |
| --- | --- | --- |
| Premium Single-Card Pack | AUD49 / exactly one Premium card | K8BXZRS7V5Q2G |
| Elite Single-Card Pack | AUD99 / exactly one Elite card | EPY3GUUNWFMRN |

The configuration is deliberately not imported into the member page. `PackProducts` remains unavailable; no PayPal script, external checkout link or live purchase endpoint has been enabled. This is preparation, not a delivered payment integration. Changing the JSON status alone must never enable checkout.

## Concrete implementation findings

- `src/core/pack-products.ts`: Premium's inventory tier is null; existing tiers are CORE/RARE/ELITE/LEGENDARY/ICON. Elite maps to ELITE. Both selection method and tax treatment are unset; rights/policy readiness is false.
- `src/server/commerce-sandbox-store.ts`: only a disposable loopback harness, backed by synthetic sandbox state. There is no hosted purchase/reservation/fulfilment path to attach these live buttons to.
- `src/server/paypal-sandbox.ts`: server-created Orders API orders and signed completed-capture verification, fixed to PayPal sandbox. It is not a verified Hosted Buttons integration. Do not assume Hosted Buttons transactions reach this app's webhook or contain its bound order IDs.
- Existing finite supply, ownership and exactly-once sandbox tests are useful foundations. They are not evidence that an external buyer can pay and receive a card on the deployed site.
- Existing beta cards are not commercial stock. Do not sell them, silently convert them, or mint outside approved permanent caps.

## Required owner answers

1. Does the buyer choose a specific player/card, or receive a random card from a disclosed pool? **Recommendation: buyer chooses a specific card.** The synthetic named-card sandbox does not establish approval.
2. Which tier/edition is Premium, which sport/player pool is sale-ready, and what finite supply is approved? Preserve existing card identities and caps. Do not choose these facts on the owner's behalf.
3. Confirm actual total-price/tax treatment, delivery and refund terms, and the permitted paid use of the chosen card content. Prior approval of all-current players for a free beta does not itself establish paid card content rights.

## Engineering activation work after product definition

1. Verify both PayPal dashboard products: merchant/payee, AUD49/AUD99, exactly one card, quantity controls, taxes/fees, inventory and description. Direct public page inspection did not return usable content in this review, so no merchant, amount or guest-card availability has been verified. In PayPal: **Pay & Get Paid → Create Payment Links and Buttons**, inspect each supplied product and Settings. Do not make real test payments.
2. Prove an authenticated Docked order-to-payment binding and finite reservation before allowing money collection. A shared hosted button alone does not provide Docked account attribution or reservation. Do not treat a payer email, browser success callback, return URL or screenshot as payment/ownership proof. If these static buttons cannot support the required binding, use the existing server-order architecture with PayPal Checkout rather than claim static embedding is equivalent.
3. Configure separate sandbox credentials, merchant ID and webhook ID server-side; connect signature verification, captured amount/currency/payee/order checks, exactly-once card fulfilment, immutable receipts and refund/dispute reconciliation. Credentials belong in scoped server environment settings, never chat or `NEXT_PUBLIC_*`. The public supplied SDK identifier does not establish availability of these credentials.
4. Run actual sandbox purchase/cancel/failure/duplicate-notification/concurrent-last-card and paid-but-unfulfilled recovery acceptance. Local mock results alone do not pass this gate.
5. Deploy to protected Preview for checkout review. Only then enable the approved sales flow in the intended admitted-user environment. Preserve the separate admission/domain readiness gates and all existing ownership, MFA and supply controls.

## Official references checked

- [PayPal Payment Links and Buttons](https://developer.paypal.com/payment-links-buttons/overview): embed buttons/payment links are checkout entry points.
- [Button settings](https://developer.paypal.com/payment-links-buttons/customize/): merchant display, methods and return settings are managed in PayPal; actual method availability must be tested for this merchant/buyer context.
- [Payment Links API](https://developer.paypal.com/api/payment-links-buttons/): API-created payment links are a separate integration; current documentation says this API does not return button code. Do not substitute undocumented APIs for the supplied buttons.
- [PayPal Checkout integration](https://developer.paypal.com/studio/checkout/standard/integrate): server-created/captured orders offer the existing Docked sandbox architecture a supported integration path.

No PayPal settings, deployment, database records, inventory, charges or Android package were changed during this configuration review. The owner-supplied live buttons must not be loaded merely for an aesthetic Preview because they can collect real money.
