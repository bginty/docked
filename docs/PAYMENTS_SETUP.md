# Shopify-native payments setup

Status: **TEST/UNCONFIGURED — NO LIVE CAPTURE**  
Last updated: 13 August 2026

## Current evidence

The repository prepares Shopify’s hosted checkout, a dynamic product payment button and footer icons generated from `shop.enabled_payment_types`. Shopify Admin payment-provider state, merchant verification, bank connection, PayPal connection, wallets, test orders, refunds and payouts have not been observed or verified. Treat every provider as **unconfigured or test-only** until Admin evidence proves otherwise.

No banking or payout details are recorded here. Do not put banking details, identity documents, PayPal credentials, Shopify tokens or payment data in Git.

## Required architecture

- Use Shopify hosted checkout and Shopify-native payment integrations only.
- Use Shopify Payments for approved card/wallet methods and connect PayPal Express through Shopify.
- Do not build a custom card form or separate Stripe/direct-PayPal stack.
- Do not store, proxy, log or test with real card data.
- Keep Shopify Payments in test mode or unconfigured until merchant verification, bank setup and all tests pass.
- Do not activate live capture or say that Docked accepts live orders.

## OWNER ACTION — SUPPLY AND VERIFY BUSINESS BANKING AND PAYMENT-PROVIDER DETAILS

The owner must enter the genuine business banking/payout details directly in Shopify Admin, complete Shopify Payments identity/business verification, and connect/authorise the genuine PayPal Business account. These values must never be sent for inclusion in source control.

## Admin setup sequence

### 1. Shopify Payments

- Open **Settings → Payments** in the correct Docked store.
- Start Shopify Payments using the exact seller details in [Legal entity details](LEGAL_ENTITY_DETAILS.md).
- The owner completes all identity, ownership, business and bank/payout fields in Shopify’s secure Admin flow.
- Resolve all verification requests; record status and date without copying sensitive evidence into Git.
- Enable test mode before any checkout test. Keep live capture off.

### 2. PayPal Express Checkout

- Connect only the genuine PayPal Business account authorised by the owner.
- Confirm the account email/entity, merchant status, currency, return URLs and Shopify connection in the provider interfaces.
- Use only supported sandbox/test procedures. Do not send a real transaction.

### 3. Cards, wallets and later methods

Visa, Mastercard, American Express, Shop Pay, Apple Pay, Google Pay, PayPal Express and PayPal Pay in 4 are potential methods only. Display and describe a method only when Shopify/provider eligibility, account configuration, customer/device context and testing confirm it.

Afterpay must not be added without merchant approval, fee review, owner approval, correct disclosure and checkout testing.

## Dynamic payment display rule

- Footer logos must continue to come from `shop.enabled_payment_types`; never hard-code a provider logo.
- Product accelerated checkout must use Shopify’s dynamic payment button. Its visible method can vary by store, provider, customer, device and browser.
- Audit the rendered footer, product page, cart and checkout after every payment-setting change. Remove any unsupported static copy or badge.
- Do not claim “secure checkout” through an unknown provider or imply that an unavailable wallet is accepted.

## Test matrix

Use Shopify Payments test mode or an approved Shopify test gateway. Never charge a real card without separate explicit owner authority.

| Test | Required result | Status |
| --- | --- | --- |
| Successful authorised payment | Test order created with expected payment/order status | **Pending — untested** |
| Declined payment | Clear failure; no paid order or fulfilment | **Pending — untested** |
| Abandoned checkout | Correct abandoned state and permitted follow-up behaviour | **Pending — untested** |
| Accelerated checkout | Only genuinely enabled/eligible method appears and reaches Shopify checkout | **Pending — untested** |
| PayPal Express | Supported test connection and return flow complete | **Pending — unconfigured/untested** |
| Cancellation | Order/payment state and customer notification reconcile | **Pending — untested** |
| Full refund | Refund succeeds in test workflow; order, notification and GST output reconcile | **Pending — untested** |
| Partial refund | Remaining balance, refunded amount, notification and GST output reconcile | **Pending — untested** |
| Fraud review | Shopify risk signals and documented hold/review process are visible | **Pending — untested** |
| Order confirmation | Correct legal/support/policy details and automatic Tax Invoice workflow trigger | **Pending — untested** |
| Payout status | Provider indicates a verified payout destination and expected status after live approval | **Pending — owner verification** |

Retain redacted order IDs, screenshots, timestamps and results. Never retain full card data, identity documents, bank data, access tokens or customer personal data in the repository.

## Live-mode gate

Switching from test to live requires all of the following: owner-supplied banking/provider details; completed merchant and payout verification; enabled methods reconciled to dynamic storefront display; payment, refund, notification and [GST/tax-invoice QA](GST_AND_TAX_INVOICE_QA.md) passed; approved shipping and policies; approved products Active; and explicit owner authorisation for live capture.

Until then, use an unpublished theme, password-protected prelaunch store or coming-soon page with Draft products. The store must not be represented as open for sales.
