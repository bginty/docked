# Docked content source of truth

Status: **CONTROL MODEL DEFINED — LIVE VALUES NOT YET APPROVED**  
Last updated: 15 August 2026

This document defines which record wins when Docked content conflicts. It does not approve any Draft product fact. The storefront is a presentation layer: a value appearing in Liquid, a CSV, a supplier listing or Shopify Admin is not evidence by itself.

## Authority hierarchy

1. **Applicable law, regulator direction and an approved exact-product compliance outcome** take priority over every commercial or copy decision.
2. **Final manufacturer/supplier evidence for the exact production SKU and revision**, reviewed and accepted in Docked's controlled compliance process, governs physical product facts and instructions.
3. **Signed specialist and owner release records** govern classification, warnings, claims, pricing and launch state.
4. **Approved registers in this repository** identify the accepted source, reviewer and status; they do not replace the underlying evidence.
5. **Shopify Admin** is the operational publishing system for approved customer-facing values, inventory and orders.
6. Theme defaults, drafts, research, competitor observations and supplier marketing are non-authoritative.

If two higher-priority sources conflict, stop publication and resolve the conflict with the responsible reviewer. Never choose the more marketable value.

## Controlled content map

| Content domain | Authoritative record | Shopify publishing location | Current state / rule |
| --- | --- | --- | --- |
| Legal seller, ABN, ACN, address, currency, time zone and owner-supplied GST status | [Legal entity details](LEGAL_ENTITY_DETAILS.md), then verified professional/Admin records | Settings, policies, footer, notifications and invoices | Owner-supplied values recorded; independent register/tax and operational verification remain where stated |
| Docked name and marks | [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md) plus retained ASIC/IP Australia/adviser outcome | Store name, logo, metadata and creative | Blocked pending name/trademark resolution |
| Product identity, supplier, model, revision, SKU and barcode | Accepted supplier dossier and [Compliance register](COMPLIANCE_REGISTER.md) | Product and variant records | DC-02 / Docked Cruise D2 is the sole current planned product; no final supplier SKU is approved; keep it non-public Draft and prohibit Active status |
| Product specifications, contents, setup, use, charging and care | Exact-SKU manual, test reports and supplier evidence accepted through [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md) | Defined `custom` metafields; see [Metafields](METAFIELDS.md) | Component reports were received 15 August 2026 but remain under review; no 160 kg load test exists and the 30/90-minute runtime, 46/66 W power and 5 km/h/1.6 m/s speed claims conflict, so none may be published |
| Product classification and compliance | [Product classification register](PRODUCT_CLASSIFICATION_REGISTER.md) and [Compliance register](COMPLIANCE_REGISTER.md), supported by specialist evidence | Product status and approved public compliance reference only | DC-02 is not approved; the lounger, complimentary pump and each of the two included batteries require applicable exact-component evidence and final-configuration review |
| Safety warnings | Final exact-SKU packaging/manual requirements and signed supplier/product-safety/legal decision recorded in [Safety copy register](SAFETY_COPY_REGISTER.md) | Product safety metafields, warning components and Safety & Care page | Current wording is Draft; do not treat it as final labelling |
| Claims | [Approved product claims](APPROVED_PRODUCT_CLAIMS.md) with exact evidence reference, scope and expiry/review trigger | Product copy, cards, collection copy, ads, metadata and structured data | Unsupported fields stay absent |
| Consumer price | Owner-approved record in [Price approval register](PRICE_APPROVAL_REGISTER.md), after landed-cost and margin approval | Product/variant price in AUD, tax settings and sales channels | Draft RRPs and competitor research are not approval |
| Compare-at price / promotion | Dated genuine-prior-price and campaign approval record | Variant compare-at price and discount configuration | Blank unless substantiated; no fake urgency |
| Inventory and availability | Counted stock at the approved Shopify location | Shopify tracked variant inventory | Shopify is the operating source; overselling and unapproved preorders remain off |
| Shipping rate, service, zone and dispatch promise | Executed carrier/service acceptance and approved [Shipping setup](SHIPPING_SETUP.md) decision record | Shipping profiles, markets and customer copy | Unknown; no rate, free-shipping threshold or delivery promise may be published |
| Returns, ACL remedy and warranty | Final adviser/owner-approved policy plus [Returns workflow](RETURNS_WORKFLOW.md) | Settings > Policies, policy pages, notifications and operations | Change-of-mind window and express warranty are unapproved; ACL rights cannot be reduced |
| Product media | Written rights record in [Asset licences](ASSET_LICENCES.md), exact-SKU match and safety approval | Shopify product media/theme editor | AI concept PNGs are not product photography or exact-SKU evidence and may not be presented as documentary product images; no product media is approved |
| Support mailbox | Successful inbound, outbound, reply-path, spam and sender-authentication evidence | Customer email, notifications, policies and forms | `support@docked.com.au` is intended but not verified |
| Analytics IDs, destinations and consent | Approved account ownership, privacy review and [Analytics setup](ANALYTICS_SETUP.md) test record | Official sales channels/app pixels or Customer events | No account IDs supplied; do not enable marketing pixels |
| Orders, payments, fulfilment, refunds and returns | Shopify order/payment/fulfilment records plus controlled incident/return records | Shopify Admin and approved operational system | No live orders authorised; no customer/card data in Git |

## Draft and verified states

Use these states consistently:

- **Unknown** — no usable source received; keep customer-facing value blank.
- **Received, boundary-reviewed** — a preliminary scope review exists, but authenticity, exact-product match, technical sufficiency and specialist acceptance have not passed; do not publish.
- **Draft** — working copy or commercial concept; preview only and never evidence.
- **Approved for Draft preview** — may appear only in an unpublished/password-protected review surface.
- **Approved for publication** — exact scope, reviewer, owner and approval date recorded; may be copied to Shopify.
- **Suspended / withdrawn** — immediately remove from sale and all marketing pending resolution.

Only `Approved for publication` values may support an Active product. Approval for one model, component, supplier or revision does not transfer to another.

## Current range boundary

DC-02 / **Docked Cruise D2** retains its existing concept ID and is the only current planned product. The other 14 concepts are withdrawn from the current plan; their prior research and register history remain recoverable at baseline commit `306e5dd` and must not be treated as current catalogue authority.

The supplier files received on 15 August 2026 are `Received, boundary-reviewed`: the preliminary review in [Supplier evidence review — DC-02](SUPPLIER_EVIDENCE_REVIEW_DC-02.md) limits them to identified components and does not authenticate or approve a final production SKU or reconciled whole-product configuration. The complimentary air pump and two included batteries are supplied components, not separate current products, and each requires its own applicable identity, safety, electrical, charging and transport evidence. DC-02 may be retained only as a non-public Draft; it must not be moved to Active, advertised, offered for checkout or otherwise represented as approved while these gaps remain.

## Change control

For every customer-facing change to a controlled value:

1. identify the exact SKU/surface and initiating source;
2. retain the source and check model, revision, issuer, date and expiry;
3. obtain the required specialist/owner approval;
4. update the relevant register first, including approver and effective date;
5. update Shopify once, then inspect every downstream surface (product, comparison, cart, policy, feed, ad and notification as applicable);
6. capture redacted QA evidence; and
7. record superseded values without deleting the audit trail.

Emergency safety changes take precedence over marketing consistency. Suspend affected products and follow [Product recall plan](PRODUCT_RECALL_PLAN.md) when risk warrants it.

## Repository and privacy boundary

This repository may contain templates, public copy, non-confidential registers and redacted references. It must not contain bank details, payment credentials, Shopify tokens, customer/order exports, personal IDs, private legal advice, confidential test reports or signed supplier contracts. Those belong in an access-controlled business record system; repository documents should reference their controlled IDs only.
