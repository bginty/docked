# Docked production launch gates

Status: **BLOCKED — NO PUBLICATION OR LIVE-SALES AUTHORITY**
Last updated: 14 August 2026 (Australia/Sydney)

This human-readable register explains the required evidence for [production-launch-gates.json](production-launch-gates.json). The JSON file is the machine-readable current state. Only `blocked`, `pending`, `passed` and `not_applicable` are permitted. A gate becomes `passed` only when actual dated evidence is linked or described; creating a checklist or template is never evidence.

## Current release evidence

- Repository: `bginty/docked`
- Release branch: `release/docked-shopify-production-2026-08`
- Starting commit: `895958891c8ec2780eba7ff224c5d0259d0de9dd`
- Current uploaded theme-source commit: `5f46487d1f53e45f5706ae945eeb5a09064893e3`
- Initial brand-refresh uploaded source: `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818`
- Previous exact uploaded source: `0b8d127b83d68930992643d666a7d26c1f1b067d`
- Store handle: `cfbexf-h4.myshopify.com`, confirmed through authenticated Shopify CLI 4.5.2
- Authenticated account display name: `Briant Ginty`; Shopify Admin showed a trial ending in 3 days and **Subscribe for $1** / **Select a plan**, so paid-plan selection remains blocked
- Theme root: repository root
- Shopify CLI: 4.5.2
- Source validation: Theme Check 187/0; structural validation 58/58; Node tests 6/6; copy and data audits passed; production gate validator 21/21 required gates and 23 total gates; dependency audit 0 vulnerabilities; documentation links 48 files/172 references/0 broken (excluding two intentional upstream PR-template placeholders); secret scan and diff checks clean
- Shopify upload evidence: existing live `Horizon` theme ID `130871099450` preserved and untouched. Historical exact source `0b8d127b83d68930992643d666a7d26c1f1b067d` was strictly pushed from 10:43:36 to 10:44:47 AEST. Initial brand-refresh source `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` and current integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` were then strictly pushed successfully on 14 August 2026 AEST; exact CLI start/end timestamps were not retained. The candidate remained unpublished as `Docked Production Candidate 2026-08`, theme ID `130871427130`, with the recorded permanent preview/editor URLs unchanged.
- Admin settings evidence: AUD, Australia/Melbourne, metric and kilograms verified; supplied business address and `support@docked.com.au` configured. After the owner's mailbox-setup report, Notifications still showed the sender as **Unverified**. A fresh verification email was requested at approximately 11:06 AEST and Shopify confirmed **Verification email sent**; the verification link and end-to-end mail tests remain outstanding. Australia is the only active market; new customer accounts are active.
- Catalogue/content evidence: 15 concepts are Draft with inventory not tracked, no images, no channels and no Active products; seven planned collections are created empty; three redirects imported; all 12 planned Shopify Pages exist with their intended template suffixes verified. Six are visible only behind the password and six remain hidden pending applicable approvals. The hidden custom Privacy Policy Page is distinct from Shopify's existing native policy resource, and neither is approved. The six-link Main menu and seven-link existing Footer menu are configured; three named footer-menu resources also exist with recorded IDs.
- Commerce configuration evidence: Australian GST collection and the prices-include-sales-tax setting were observed, but transaction/invoice testing has not run. Domestic Australia has no shipping rates, international shipping is absent, pickup/delivery are off, Shopify Payments is not set up and no provider/test transaction exists.
- Rendered evidence: partial manual in-app-browser QA completed at 320, 360, 375, 390, 768, 1024 and 1440 px after current integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` was pushed. Every tested width had document/body `scrollWidth` equal to `innerWidth`; at 320 px, viewport/document/body widths were exactly `320/320/320`. The integrated header wordmark measured `110 × 25.71` px with SVG viewBox `0 0 650 152`, hero art `288 × 345.6` px, its note `248 × 79.4` px and footer wordmark `220 × 51.44` px. Header widths across the seven viewports were `110/157.575/163.963/180/180/180/180` px; footer widths were `220/220/220/152/216/220/220` px. At 1440 px, header/footer/hero widths were `180/220/552.14` px and navigation remained intact. The 320 px mobile menu opened with the exact six links and no overflow. Header/footer home links exposed `Docked — home`; the navy/cyan/white brand presentation, hero `18+` seal and complete preview-art accessible label rendered; the favicon resolved from the theme asset; Organization JSON-LD used an absolute `docked-mark.svg` asset URL; and the final console had no errors or warnings. The password page rendered the hidden `Docked` name, theme favicon, H1 and modal on the initial brand push; the final source changed only wordmark SVG geometry. Screenshot/CDP capture timed out, so no new screenshot artifact supports this latest brand run. Earlier route, menu, FAQ, Contact and account-entry observations remain recorded. Mailbox delivery, full multi-browser, visual screenshot, accessibility, Lighthouse, product and checkout testing remains incomplete.
- Public site: the legacy GitHub Pages finance site remains recoverable and publicly served
- Gate totals: **4 passed; 19 blocked; 0 pending; 0 not applicable**

## Hard stop gates

The exact **DOCKED** business name appeared in the preliminary ASIC public-register search as registered to another holder. This remains a hard blocker for both public prelaunch and live sales. Domain ownership and a zero-result exact trademark quick search do not resolve it. The accepted resolution evidence is a current lawful business-name/brand decision supported by appropriate documentation as described in [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md).

No genuine SKU is currently approved, no exact-SKU licensed product media is supplied, no product compliance or insurance is evidenced, and no final price, tracked stock or approved shipping is available. Payment, tax-invoice, refund, support-mailbox and complete rendered-preview testing have not passed. Accordingly, public sales cannot be authorised.

## Gate register

| Gate | Current state | Minimum passing evidence |
| --- | --- | --- |
| Brand-name resolution | Blocked | Written lawful resolution of the exact-name issue, or a documented cleared replacement brand, reviewed by the appropriate owner/adviser |
| Shopify store created | Passed | Owner-supplied handle plus signed-out rendered Shopify password page at `cfbexf-h4.myshopify.com/password`; this passes existence only |
| Shopify Admin authenticated | Passed | Shopify CLI 4.5.2 authenticated to and returned theme metadata for `cfbexf-h4.myshopify.com`; no credential recorded |
| Storefront password enabled | Passed | Signed-out request redirects to the Shopify password page; reverify immediately before any publication decision |
| Shopify paid plan selected | Blocked | Admin currently shows a trial ending in 3 days and plan-selection prompts; owner must select an appropriate paid plan and retain redacted plan-status evidence |
| Theme preview uploaded | Passed | Current source `5f46487d1f53e45f5706ae945eeb5a09064893e3` cleanly pushed with `--strict` to unpublished `Docked Production Candidate 2026-08`, ID `130871427130`, with permanent preview/editor URLs unchanged and live `Horizon` preserved |
| Rendered QA passed | Blocked | Completed multi-browser/viewport, accessibility and Lighthouse evidence against the permanent preview on the exact theme/commit |
| Support email verified | Blocked | External message sent to the mailbox and received; reply sent from the mailbox and received externally; contact-form, order and refund notifications delivered; SPF, DKIM and DMARC reviewed |
| Approved products available | Blocked | At least one exact SKU with supplier/model, evidence dossier, manual, owner activation approval and all individual gates complete |
| Licensed product media available | Blocked | Exact-SKU media licence register and controlled proof of permission, adult/safety review and model match |
| Product compliance approved | Blocked | Applicable classification, safety, electrical/charger/RCM, battery/transport and warning evidence for each proposed Active SKU |
| Product liability insurance reviewed | Blocked | Broker/insurer confirmation covering the exact products, activities, entity and Australian territory |
| Final prices approved | Blocked | Dated owner approval of landed cost, GST-inclusive retail price, margin and any promotion basis per SKU |
| Inventory approved | Blocked | Counted saleable stock by SKU/location, inventory tracking on, overselling off and approval record |
| Shipping approved | Blocked | Measured packs, dispatch origin, contracted rate/service, remote rules and exact battery-carrier acceptance where applicable, followed by checkout tests |
| Policies approved | Blocked | Dated owner **or** appropriate adviser approval of the exact policy versions and legal identity treatment, followed by verification of the published versions |
| GST and tax invoice testing | Blocked | Qualified configuration review and reconciled full-price, discount, shipping, multi-item, cancellation and refund/partial-refund invoice tests |
| Shopify Payments verified | Blocked | Merchant, identity and bank verification status plus enabled-method/test evidence; no sensitive details in Git |
| PayPal Express verified | Blocked | Genuine authorised PayPal Business connection and supported test-flow evidence, or a documented owner-approved decision to defer PayPal and mark this gate `not_applicable` |
| Test order passed | Blocked | Redacted successful/declined/order/inventory/notification/account-history records using Shopify-supported test mode |
| Refund test passed | Blocked | Redacted full and applicable partial refund records with inventory, notification, GST and invoice reconciliation |
| DNS access available | Blocked | Authenticated DNS-provider access by an authorised operator and full private-zone export; public DNS queries alone do not prove write access |
| Owner final authorisation | Blocked | The correct exact phrase received in the active Codex session after all prerequisite gates pass, with authorising account and timestamp |

## Evidence handling

Every evidence entry must identify:

- gate and result;
- evidence type and a redacted reference or repository-relative path;
- date/time and Australia/Sydney timezone;
- operator/source and reviewer;
- related Shopify store, theme ID, commit, SKU, payment test or DNS record where applicable;
- whether sensitive source material is retained in an approved controlled location; and
- any expiry, conditions or scope limits.

Do not commit access tokens, passwords, bank details, identity documents, full card data, PayPal credentials, unredacted customer data, signed confidential supplier terms or private insurance documents. Reference controlled records with non-sensitive identifiers.

## Authorisation modes

### Public prelaunch

Required exact phrase: `AUTHORISE_DOCKED_PUBLIC_PRELAUNCH`

The phrase is valid only after the business-name issue is resolved and the intended public material is approved. It allows domain connection and publication of an approved coming-soon/catalogue experience while every unapproved product remains Draft, checkout remains unavailable and live payments remain disabled. It does not authorise sales.

### Full commercial launch

Required exact phrase: `AUTHORISE_DOCKED_DOMAIN_CUTOVER_AND_LIVE_SALES`

The phrase must not be accepted until every applicable gate is already passed. It allows the controlled domain cutover, tested-theme publication, activation of only approved SKUs, password removal and verified live capture. Live payments are the final launch action.

No authorisation phrase has been received for this release.

## Gate update procedure

1. Obtain the actual evidence; do not infer it from a prepared page or configuration intention.
2. Validate that it applies to the exact store, theme, commit, SKU, account or DNS zone.
3. Store sensitive material outside Git and enter a redacted reference.
4. Update both this register and [production-launch-gates.json](production-launch-gates.json).
5. Re-run JSON validation, relative-link validation, source checks and secret scan.
6. Record the resulting commit before any publication decision.

See [Production deployment](PRODUCTION_DEPLOYMENT.md), [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md), [Domain cutover record](DOMAIN_CUTOVER_RECORD.md), [Post-launch QA](POST_LAUNCH_QA.md) and [Production rollback](PRODUCTION_ROLLBACK.md).
