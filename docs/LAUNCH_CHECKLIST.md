# Docked launch checklist

Status: **STOP — NOT PRODUCTION LIVE**  
Last updated: 13 August 2026

Current verified repository state: theme/catalogue preparation is in progress; the catalogue register contains 15 Draft concepts and no Active products. Shopify Admin, payment providers, product evidence, licensed product media, shipping, support mailbox, live checkout, published theme and production domain have not been verified. An unchecked item is a launch blocker unless explicitly marked post-launch.

This checklist is an evidence index, not permission to self-certify. Complete each row with the named operator/reviewer, timestamp and a redacted evidence location. A passing theme test does not approve a product, payment account or legal/compliance decision.

## 1. Release authority and stop conditions

- [ ] All applicable items in [Owner actions](../OWNER_ACTIONS.md) are closed with dated evidence.
- [ ] Every applicable item in [Launch blockers](LAUNCH_BLOCKERS.md) is closed or has a signed, lawful launch decision that does not expose customers to an unapproved risk.
- [ ] Owner has signed a final launch record authorising the exact Active SKUs, final prices, stock, theme, live payment capture and DNS cutover.
- [ ] Named go/no-go lead, Shopify operator, DNS operator, payments owner, fulfilment lead, support lead, safety/recall lead and rollback operator are available for launch.
- [ ] No unresolved safety, compliance, payment, tax, shipping, privacy, security, accessibility or data-loss severity-one issue remains.
- [ ] Rollback thresholds and decision authority are agreed; rollback does not require improvising credentials or DNS values.

**Immediate no-go:** any unapproved Active SKU; missing exact-SKU safety/classification evidence; unsupported product claim; fake/borrowed media; inaccurate inventory; unavailable approved carrier; broken checkout/refund; unverified live capture/payout; wrong GST/tax invoice; unavailable support channel; unsafe critical path; domain/SSL/mail failure; or inability to restore the prior deployment.

## 2. Source, repository and release artefact

- [ ] Correct repository and `codex/docked-pool-commerce-rebuild` release branch confirmed; no Oura CRM or unrelated project files included.
- [ ] Legacy recovery references exist and resolve: archive branch `archive/docked-finance-site-2026-08`, annotated tag `docked-finance-site-before-pool-rebuild`, and legacy commit `b26add982e5f4c7cfab2b13f74a14500d7199530`.
- [ ] Dawn licence remains in [`LICENSE.md`](../LICENSE.md) and asset provenance passes [Asset licences](ASSET_LICENCES.md).
- [ ] Working tree is clean; intended changes reviewed; no secrets, Shopify auth files, bank data, customer data, private keys or credentials committed.
- [ ] Theme Check, JSON/schema validation, unit/structural tests and production build/packaging checks pass on the exact release commit.
- [ ] Pull-request validation passes; protected production publication cannot occur on a failed check.
- [ ] Release commit/tag, reviewer, theme ZIP checksum and rollback theme ID are recorded.
- [ ] Unpublished Shopify theme upload succeeds with no rejected/missing files; release artefact excludes internal docs/data/tests as configured.

## 3. Shopify foundation and Admin

Follow [Shopify Admin setup](SHOPIFY_ADMIN_SETUP.md).

- [ ] Correct Shopify store/owner confirmed; plan and Online Store channel support the intended launch.
- [ ] Store name, legal seller, address, Australia, AUD, Australia/Melbourne and kilograms configured from [Legal entity details](LEGAL_ENTITY_DETAILS.md).
- [ ] Primary market is Australia; international markets are disabled unless separately approved.
- [ ] Theme uses the approved Shopify Online Store 2.0 release and remains unpublished until all gates pass.
- [ ] Store has completed the required Dawn v16 customer-account compatibility/upgrade gate; signed-out, sign-in, account menu, order history and sign-out flows pass or accounts remain deliberately disabled.
- [ ] Seven intended collections and approved handles exist and are reviewed: Powered Pool Floats, Adult Pool Loungers, Adult Pool Games, Floating Bars and Coolers, Pumps, Care and Repair, Pool Party Bundles, and Shop All.
- [ ] Desktop/mobile navigation and footer link only to real approved resources; no empty social account or misleading payment icon appears.
- [ ] Theme editor controls, fallback states and section reordering work without code changes.
- [ ] Password/prelaunch mode presents truthful availability and does not permit or imply live orders.

## 4. Brand, legal and policy content

- [ ] Docked business-name registration/use and trademark review are resolved under [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md).
- [ ] Public entity wording is exact: GINTY UNITED INVESTMENTS PTY LTD; ABN 78 606 187 106; ACN 606 187 106 where appropriate; owner-supplied GST registration basis reviewed.
- [ ] Address appears only with: “Correspondence and authorised returns only. No public showroom or walk-in service.”
- [ ] Final Privacy, Terms, Returns & Refunds, Shipping & Delivery, Warranty and Accessibility content has appropriate Australian legal/adviser and owner approval.
- [ ] Policies appear in the storefront, checkout and notifications where applicable; no contradictory version remains.
- [ ] ACL wording is present and no clause says no refunds/all sales final, forces the customer only to the manufacturer, or purports to exclude non-excludable rights.
- [ ] Newsletter/contact consent is unambiguous, not preselected, and linked to the approved privacy disclosure.
- [ ] All legal, policy and support dates/owners are recorded in [Content source of truth](CONTENT_SOURCE_OF_TRUTH.md).

## 5. Catalogue, products and pricing

Planned catalogue: 7 collections; 3 powered-float concepts; 5 adult-lounger/island/deck concepts; 1 pool-game concept; 6 cooler/pump/care/accessory concepts; 0 Active; 15 Draft. Confirm actual Shopify counts immediately before launch.

- [ ] Every product has a final supplier, manufacturer, model/revision, SKU, barcode where applicable, variant architecture and signed supply authority.
- [ ] Each product/variant appears in exactly the intended collections with the actual brand/vendor disclosed; Docked manufacture is not implied unless true.
- [ ] Every proposed Active SKU has a completed [SKU approval workflow](SKU_APPROVAL_WORKFLOW.md), [Compliance register](COMPLIANCE_REGISTER.md) and owner release.
- [ ] Draft catalogue reconciles to Shopify; no Draft/unlisted product appears in navigation, search, collection, feed, recommendation, sitemap or advertising.
- [ ] Final landed cost, GST-inclusive RRP, margin/freight model and launch stock are owner-approved in [Price approval register](PRICE_APPROVAL_REGISTER.md).
- [ ] Compare-at prices are blank unless a genuine substantiated prior-price/promotion record exists.
- [ ] No fake low-stock message, countdown, fabricated saving, fake review/testimonial, seeded rating, forced add-on or urgency/scarcity device exists.
- [ ] Inventory tracking is on, quantities match counted saleable stock, overselling is off and preorders are disabled unless separately approved with truthful timing.
- [ ] Product cards accurately show title, actual brand, AUD/GST-inclusive price, Adult 18+, powered state, verified occupancy and stock state.

## 6. Evidence, classification, safety and product media

- [ ] [Supplier onboarding](SUPPLIER_ONBOARDING.md) dossier is accepted for every supplier/SKU.
- [ ] Australian product-safety/legal classification is complete for every aquatic product; aquatic-toy, swimming/flotation aid, PFD and other mandatory-standard applicability is resolved.
- [ ] Powered products have approved motor/guard/control, electrical/EESS/RCM, EMC/radio (if applicable), water-ingress and fail-safe evidence.
- [ ] Battery chemistry, voltage, capacity, watt-hours, approved charger, transport evidence, storage/damage/disposal instructions and carrier acceptance are complete.
- [ ] Product-liability insurance covers the exact products, activities and launch territory.
- [ ] Every published specification/claim maps to exact-SKU evidence in [Approved product claims](APPROVED_PRODUCT_CLAIMS.md); unverified fields remain empty.
- [ ] Shopify definitions/values pass [Metafields](METAFIELDS.md); units, booleans, rich text, URLs and comparison visibility are correct.
- [ ] Full approved warnings reconcile across permanent product marking, packaging, manual, product page and Safety & Care page under [Safety copy register](SAFETY_COPY_REGISTER.md).
- [ ] Critical adult/pool-use warning sits visibly near Add to Cart; powered warning is separate; no warning is only tiny/collapsed.
- [ ] Final product manuals download correctly and match the exact revision.
- [ ] Every image/video has a valid record in [Asset licences](ASSET_LICENCES.md), depicts the exact SKU, uses adult models only for aquatic products and passes safety review.
- [ ] No placeholder, competitor, marketplace, scraped, hotlinked or unlicensed image/copy/review appears on an Active product or live campaign.
- [ ] Product recall process, named contacts and order-to-batch/batch-to-order lookup pass a tabletop exercise under [Product recall plan](PRODUCT_RECALL_PLAN.md).

## 7. Storefront commerce and checkout

- [ ] Home, all collection templates, product, How It Works, Safety & Care, Shipping, Returns, Warranty, FAQ, About, Contact, Track Order, Privacy, Terms, Accessibility, cart, search, 404 and password pages exist and render correctly.
- [ ] Collection filters/sorting and Search & Discovery configuration work for the approved catalogue and yield useful empty/no-result states.
- [ ] Product gallery, zoom, video, thumbnails, variant/quantity selectors, inventory, product form, Add to Cart, error state and mobile sticky Add to Cart pass.
- [ ] Product comparison hides when fewer than two real products are selected and hides a row unless all compared products have verified values.
- [ ] Cart drawer and cart page support update/remove/subtotal/continue shopping, keyboard/focus/Escape/screen-reader status and error recovery without hidden fees or preselected extras.
- [ ] Shopify-hosted checkout only; no custom card form or non-approved payment stack.
- [ ] Customer, address, shipping, tax, discount, order confirmation, cancellation and abandoned-checkout flows pass on mobile/desktop.
- [ ] Payment icons are generated only from genuinely enabled Shopify payment types.
- [ ] No real card is used for testing without explicit owner action.

## 8. Payments, GST and tax invoices

Follow [Payments setup](PAYMENTS_SETUP.md) and [GST and tax-invoice QA](GST_AND_TAX_INVOICE_QA.md).

- [ ] **OWNER ACTION — SUPPLY AND VERIFY BUSINESS BANKING AND PAYMENT-PROVIDER DETAILS** is complete through provider-secure interfaces; no credentials are in Git.
- [ ] Shopify Payments business/identity/payout verification is approved; enabled cards/wallets are confirmed.
- [ ] Genuine PayPal Business account is connected as PayPal Express; Pay in 4 is mentioned only where PayPal determines eligibility and the display is approved.
- [ ] Test mode/gateway passes success, decline/failure, abandoned checkout, cancellation, full refund and partial refund; live mode is enabled only after final owner authority.
- [ ] Payout currency/account and provider status are verified; a test status is not described as live acceptance.
- [ ] Australian retail product, cart and checkout prices show AUD and include GST; discounts and shipping tax treatment reconcile.
- [ ] Automatic Tax Invoice includes required label, legal seller, ABN, invoice date/number, customer details where required, item/quantity, GST-inclusive amount, GST component, shipping, discount, total, support email and address.
- [ ] Full-price, discount, shipping charge, multiple-item, bundle, full refund and partial refund invoice tests pass; gift card test passes only if later enabled.
- [ ] Accountant/qualified reviewer signs the final GST and invoice outputs.

## 9. Shipping, fulfilment, returns and support

- [ ] Every Active variant has verified packed dimensions/weight, fulfilment location and final package.
- [ ] [Shipping setup](SHIPPING_SETUP.md) has carrier/service acceptance, approved GST-inclusive rates, remote-area rules and Australia-only zones; mixed-profile checkout tests pass.
- [ ] Express appears only for eligible products/postcodes; unapproved free shipping, dispatch promise, local pickup and international shipping remain absent.
- [ ] [Order operations](ORDER_OPERATIONS.md) simulations pass for payment/fraud holds, cancellation, refund, replacement, damage and loss.
- [ ] [Fulfilment workflow](FULFILMENT_WORKFLOW.md) passes pick, QC, pack, battery, batch traceability, handoff, tracking, split shipment and inventory reconciliation tests.
- [ ] [Returns workflow](RETURNS_WORKFLOW.md) passes change-of-mind, ACL defect, warranty, battery/safety, inspection, refund/restock and exchange scenarios.
- [ ] Quarantine/storage and safe defective-battery handling are operational; ordinary return labels cannot be issued to damaged/recalled/restricted batteries.
- [ ] `support@docked.com.au` mailbox exists and passes inbound, outbound, reply-path, sender authentication, spam and notification tests; no reply routes to personal Gmail.
- [ ] SPF, DKIM and DMARC are verified without damaging existing mail delivery; existing MX is preserved through cutover.
- [ ] Support hours/response expectations are truthful and trained staff can access orders, policies and safety escalation.

## 10. SEO, analytics, privacy and marketing

- [ ] [SEO migration](SEO_MIGRATION.md) pre-cutover audit passes: titles/descriptions/H1s, canonicals, internal links, alt text, schema, `robots.txt`, sitemap and no former finance metadata/content.
- [ ] Only the three approved rows in [`data/url-redirects.csv`](../data/url-redirects.csv) are imported after targets exist; `/faq.html`, `/terms.html` and `/preview.html` return the branded 404/approved 410 rather than an irrelevant redirect.
- [ ] `https://docked.com.au` is canonical, `www` redirects consistently, SSL is valid, and no preview/canonical leak appears.
- [ ] Product/Offer schema uses real Shopify price/availability; no Review/AggregateRating exists without genuine verified data; no duplicate product graph.
- [ ] Search Console owner/property is verified and production sitemap submitted after launch; Merchant Center remains off until product/feed/policy/shipping compliance passes.
- [ ] [Analytics setup](ANALYTICS_SETUP.md) data-flow/privacy review, account ownership, official channel/app-pixel connection, consent states, duplicate-tag audit, event and purchase/refund attribution tests pass.
- [ ] No optional marketing pixel runs without the required permission; visitors can revisit consent preferences.
- [ ] Newsletter and contact measurement records confirmed success only and send no free-text/personal/payment data to analytics.
- [ ] Paid audiences are adult-targeted where supported and do not target children/baby/toddler pool-product searches.

## 11. Accessibility, quality and security QA

- [ ] WCAG 2.2 AA review covers keyboard-only operation, visible focus, skip link, headings/landmarks, labels/errors, dialogs/drawers, live regions, image alt text, contrast, zoom/reflow, motion reduction and screen reader output.
- [ ] Age confirmation, if enabled after review, is accessible, session-scoped and never used as a substitute for safe merchandising/compliance.
- [ ] Test viewport matrix includes at least 320, 375, 768, 1024 and 1440 CSS pixels; iOS Safari, Android Chrome and current desktop Chrome/Firefox/Edge/Safari as available.
- [ ] No horizontal overflow, clipped controls, obstructive sticky UI, layout shift from unreserved media, autoplay audio or inaccessible video.
- [ ] JavaScript-disabled core navigation/content/product form degrades appropriately; decorative motion respects `prefers-reduced-motion`.
- [ ] Performance evidence records Core Web Vitals/Lighthouse on representative home, collection, product and cart routes using approved media; regressions have owners.
- [ ] Broken-link, console error, Liquid error, missing asset, 404/canonical, schema and HTML/accessibility scans pass.
- [ ] Storefront/code scan finds no old finance business copy outside historical docs, no fake claims/reviews/urgency, no child-focused copy/media and no secret/credential pattern.
- [ ] Contact, newsletter, search, cart and account inputs handle errors safely; no raw HTML/script injection or sensitive value appears in URL/log/analytics.
- [ ] Shopify staff/app permissions are least-privilege; unused apps/channels/pixels are removed; account MFA/recovery and ownership are verified.
- [ ] QA screenshots for home, collection, product, cart, mobile navigation, Safety & Care, password and 404 are retained against the exact release commit/theme ID.

## 12. Publication and DNS cutover

No DNS change until every prior launch gate passes and owner authorises the cutover.

- [ ] Export/screenshot the full DNS zone and record actual configured TTLs; compare with [DNS before change](DNS_BEFORE_CHANGE.md).
- [ ] Record existing Shopify published theme name/ID and keep the legacy GitHub Pages deployment available.
- [ ] Confirm [Rollback plan](ROLLBACK_PLAN.md) with authorised DNS/Shopify operators; test access to required accounts without exposing credentials.
- [ ] Publish the exact approved theme and only the exact approved products; record IDs/timestamp/operator.
- [ ] Enable live payment capture only under the dated owner authorisation; verify a legitimate owner-approved live transaction/refund only if separately authorised.
- [ ] Change only Shopify-required web records; preserve MX, SPF, DKIM, DMARC, CAA, SRV and verification TXT; do not change nameservers solely to connect Shopify.
- [ ] Verify apex/`www`, SSL, theme, Active products, checkout, payment, tax invoice, notifications, shipping, search, policies, support and 404 from external networks/signed-out sessions.
- [ ] Verify mail inbound/outbound after DNS propagation.
- [ ] Start 1-hour, 24-hour, 7-day and 30-day monitoring with named owners; review orders/payments, errors, 404s, indexing, support, fraud, inventory and safety reports.

## Launch status rules

| Status | May be used only when |
| --- | --- |
| **Catalogue Architecture Complete** | Theme collection/product/filter/search/comparison/adult/safety architecture and Draft catalogue are complete and tested; no invented data or unapproved Active product exists. This does not mean Shopify Admin objects or sales are live. |
| **Code Complete — Owner Action Required** | Theme and catalogue deliverables/tests are complete, while products remain Draft and owner/supplier/compliance/banking/media/price/operational gates are accurately listed. Use password/unpublished mode. |
| **Production Live** | Every applicable checkbox above is evidenced, owner launch authority is recorded, theme/products/payments/shipping/support/domain are actually live and live-site QA passes. |

Current permitted status is **not Production Live**. The final project report must use the lower status supported by direct evidence; it must not infer completion from prepared documentation.

## Final evidence ledger

| Gate owner | Gate | Result | Evidence location | Reviewer / timestamp |
| --- | --- | --- | --- | --- |
| Engineering | Exact release source tests | Passed — structural validator, Node tests, copy audit and Theme Check; theme upload not run because no store is configured | `scripts/validate-theme.mjs`; `tests/theme-structure.test.mjs`; local QA output | Codex / 14 August 2026 |
| Owner/legal | Brand, legal, policies and launch authority | Blocked |  |  |
| Product safety | Each proposed Active SKU approved | Blocked — 0 approved |  |  |
| Commercial | Costs, prices, stock, shipping and warranty | Blocked |  |  |
| Finance | Payments, payout, GST and invoices | Blocked |  |  |
| Operations | Fulfilment, returns, support and recall | Blocked |  |  |
| Privacy/marketing | Consent, analytics and channels | Blocked |  |  |
| QA | Accessibility, browser, mobile, performance and live site | Source-level responsive/accessibility/prelaunch gates passed; rendered Shopify preview, Lighthouse and live-site QA not run | `tests/storefront.spec.mjs` is configured for 320/375/768/1024/1440 but skipped without `SHOPIFY_PREVIEW_URL` | Codex / 14 August 2026 |
| Deployment | Theme publication, DNS/SSL and rollback | Not authorised |  |  |
