# Docked analytics, attribution and consent setup

Status: **RUNBOOK ONLY — NO ACCOUNT IDS, PIXELS OR LIVE EVENTS VERIFIED**  
Last updated: 13 August 2026

Use Shopify Analytics first, then add only approved channels that answer a documented business question. No Google Analytics, Search Console, Merchant Center, Meta or email-platform account ID has been supplied. Do not put account IDs into theme files, duplicate scripts across layouts, or enable marketing pixels before account ownership and privacy/consent settings are approved.

## Integration architecture

| Capability | Preferred integration | Current state |
| --- | --- | --- |
| Shopify commerce reporting | Native Shopify Analytics and order reports | Store/Admin not inspected |
| Google Analytics 4 | Official Google & YouTube sales channel connected to an owner-controlled GA4 property | Not connected; ID not supplied |
| Google Search Console | Owner-controlled Domain property; submit Shopify sitemap after launch | Not verified |
| Google Merchant Center | Official Google & YouTube channel after every submitted SKU, policy, shipping and compliance gate passes | Not connected; all products Draft |
| Meta Pixel | Official Facebook & Instagram/Meta sales channel app pixel after account and consent approval | Not connected; Pixel ID not supplied |
| Newsletter | Shopify/native approved provider with explicit subscription consent and source reporting | Provider/measurement not approved |
| Custom measurement | Shopify Customer events / Web Pixels only when an official app pixel cannot meet a documented need | None approved |

Shopify recommends app pixels where possible because they run through the supported Web Pixels architecture. Pixel manager lives under **Settings > Customer events**. Official references: [pixels and customer events](https://help.shopify.com/en/manual/promoting-marketing/pixels), [app pixels](https://help.shopify.com/en/manual/promoting-marketing/pixels/app-pixels), [GA4 setup](https://help.shopify.com/en/manual/reports-and-analytics/google-analytics/google-analytics-setup), and [standard Web Pixel events](https://shopify.dev/docs/api/web-pixels-api/standard-events).

## Event measurement plan

These are Shopify standard event names, not custom JavaScript event inventions:

| Business action | Shopify standard event | Required parameters / QA use | Reporting outcome |
| --- | --- | --- | --- |
| Page view | `page_viewed` | URL, title/referrer as exposed by approved pixel API | Sessions and landing pages |
| Collection view | `collection_viewed` | Collection identity | Collection discovery |
| Product view | `product_viewed` | Product/variant identity, approved price/currency | Product funnel |
| Store search | `search_submitted` | Search query; ensure reports do not expose sensitive input | Search demand and zero-result review |
| Cart view | `cart_viewed` | Cart line data | Cart funnel |
| Add to cart | `product_added_to_cart` | Product/variant, quantity, value, AUD | Add-to-cart rate |
| Remove from cart | `product_removed_from_cart` | Product/variant, quantity/value | Cart friction |
| Begin checkout | `checkout_started` | Checkout/order token as platform provides; item/value/currency | Checkout-start rate |
| Checkout contact step | `checkout_contact_info_submitted` | Platform-provided event only; do not forward raw contact details | Funnel diagnostics |
| Checkout address step | `checkout_address_info_submitted` | Platform-provided event only; do not forward raw address | Funnel diagnostics |
| Shipping step | `checkout_shipping_info_submitted` | Selected service/value where platform/integration permits | Shipping friction |
| Payment step | `payment_info_submitted` | Never card number or sensitive payment data | Funnel diagnostics |
| Purchase | `checkout_completed` | Unique transaction/order ID, value, tax, shipping, AUD and items as provided by platform | Revenue and purchase attribution; deduplicate on transaction ID |

`checkout_completed` is the purchase source; do not create a second theme-level purchase tag. Never send customer email, phone, full address, free-text contact messages, payment details or unredacted order notes to analytics.

### Docked form outcomes

Shopify's standard event catalogue does not by itself define Docked-specific newsletter/contact submission events. Reserve these names only if a later approved implementation can publish on **confirmed success**, not on button click:

| Proposed custom event | Success condition | State |
| --- | --- | --- |
| `docked_newsletter_signup_completed` | Shopify/provider confirms a subscription-form success and consent text was visible | Proposed; not implemented |
| `docked_contact_submission_completed` | Shopify contact form returns a confirmed success state | Proposed; not implemented |

Before implementation, document purpose, lawful/consent basis, exact non-personal payload, retention, destination, owner and test. If native/provider reporting answers the question, do not add a custom event.

## Attribution rules

- Use consistent UTMs: lowercase `utm_source`, `utm_medium`, `utm_campaign`; add `utm_content`/`utm_term` only when needed. Keep a controlled campaign register outside the theme.
- Preserve landing-page UTMs through the official integration; do not write a parallel long-lived identifier into custom cookies.
- Use `checkout_completed` and Shopify's order/conversion details as the transaction anchor. GA4/Meta are secondary attribution views and will not necessarily reconcile exactly with Shopify.
- Configure payment-provider/referral exclusions in the analytics property when official setup requires it, then test returning from every enabled payment method.
- Never count test, cancelled or fully refunded orders as net commercial performance without an explicit report definition. Reconcile gross sales, discounts, returns/refunds, tax, shipping and net sales with Shopify.
- Record campaign time zone as Australia/Melbourne and currency as AUD across properties where configurable.

## Consent and privacy gate

1. Complete a data-flow inventory and approve the Privacy Policy before enabling optional tracking.
2. Review **Settings > Customer privacy** for the active Australia-only market and any future visitor regions. Shopify's automated settings are not legal advice.
3. Prefer Shopify's cookie banner and app pixels. If another consent platform is genuinely required, it must integrate with Shopify's Customer Privacy API.
4. Validate the four processing permissions exposed by the current API: `preferencesProcessingAllowed`, `analyticsProcessingAllowed`, `marketingAllowed`, and `saleOfDataAllowed`. Do not read or change Shopify cookies directly.
5. Confirm non-essential analytics/marketing destinations do not receive events when their required permission is false and begin correctly after an actual visitor choice.
6. Provide a persistent way to revisit cookie preferences and ensure the privacy policy accurately lists every recipient/purpose.

References: [Shopify customer privacy settings](https://help.shopify.com/en/manual/privacy-and-security/privacy/customer-privacy-settings/privacy-settings) and [Customer Privacy API](https://shopify.dev/docs/api/customer-privacy).

## Setup sequence

- [ ] Owner supplies and verifies account ownership/admin access for each approved platform.
- [ ] Record property/pixel IDs in an access-controlled operations record, not in Git unless a public ID is intentionally configuration-managed.
- [ ] Confirm store URL, Australia/Melbourne time zone, AUD, internal traffic rules and data retention.
- [ ] Connect GA4 through Google & YouTube; do not paste a duplicate `gtag` into `theme.liquid`.
- [ ] Connect Meta only through the approved official channel/app pixel and record its data-sharing setting.
- [ ] Configure Search Console after production-domain verification and submit `sitemap.xml` per [SEO migration](SEO_MIGRATION.md).
- [ ] Keep Merchant Center product sync off until products are Active, approved, accurately stocked/priced/shipped and policy-complete.
- [ ] Review Customer events for duplicate app/custom pixels and remove obsolete finance-site tags/goals.
- [ ] Define Shopify/GA4/Meta/newsletter reporting owners and monthly reconciliation cadence.

## Test procedure

Use an unpublished test/dev environment and Shopify test payments; never place a real charge solely for analytics QA.

1. Start with a clean browser and capture consent-default state.
2. Decline optional processing; browse home, collection and product and confirm prohibited destinations remain silent.
3. Change consent through the visible preference control; confirm only permitted processing begins.
4. Use Shopify Pixel Helper to observe `page_viewed`, `collection_viewed`, `product_viewed`, `product_added_to_cart`, `cart_viewed`, `checkout_started`, shipping-step and `checkout_completed` events as applicable. Shopify notes the helper is not compatible with password-protected stores, so use a controlled test window only after approval.
5. Complete one Shopify test order; verify a single purchase with the exact test transaction ID, AUD value, tax, shipping and item quantity in each enabled destination.
6. Repeat failed payment, abandoned checkout, cancellation, full refund and partial refund scenarios. Record how each platform reports them.
7. Test UTM landing attribution and payment return; confirm no self-referral and no loss/duplication.
8. Submit newsletter/contact test forms with non-customer test data and verify success-only measurement if those events were approved.
9. Check mobile/desktop, major supported browsers, ad blockers and consent changes. Analytics loss caused by consent/blocking must not be “fixed” by bypassing choice.
10. Reconcile the test order in Shopify, GA4 and any enabled ad platform; explain expected differences before sign-off.

Shopify's official [Pixel Helper test guide](https://help.shopify.com/en/manual/promoting-marketing/pixels/custom-pixels/testing) describes real-time event inspection.

## Approval record

| Gate | Status | Owner / evidence / date |
| --- | --- | --- |
| Data-flow and privacy review | Not started |  |
| Shopify Analytics baseline | Not verified |  |
| GA4 account/channel connection | Blocked — account ID/access missing |  |
| Search Console property | Not verified |  |
| Merchant Center | Blocked — catalogue not launch-approved |  |
| Meta Pixel | Blocked — account ID/access and consent review missing |  |
| Newsletter/contact success events | Not implemented |  |
| Consent-state tests | Not run |  |
| Purchase/refund attribution tests | Not run |  |
| Duplicate/legacy tag audit | Not run |  |

