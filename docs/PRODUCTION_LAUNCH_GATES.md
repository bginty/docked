# Docked production launch gates

Status: **BLOCKED — NO PUBLICATION OR LIVE-SALES AUTHORITY**
Last updated: 15 August 2026 (Australia/Sydney)

This human-readable register explains the required evidence for [production-launch-gates.json](production-launch-gates.json). The JSON file is the machine-readable current state. Only `blocked`, `pending`, `passed` and `not_applicable` are permitted. A gate becomes `passed` only when actual dated evidence is linked or described; creating a checklist or template is never evidence.

## Current release evidence

- Repository: `bginty/docked`
- Release branch: `release/docked-shopify-production-2026-08`
- Starting commit: `895958891c8ec2780eba7ff224c5d0259d0de9dd`
- Current uploaded theme-source commit: `bb41a70d630041e95f627d05c62b7247b04257f7`
- Current one-product source revision: committed and strictly pushed to candidate theme `130871427130`; limited password-page/editor evidence only, full rendered QA blocked
- Initial brand-refresh uploaded source: `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818`
- Previous exact uploaded source: `0b8d127b83d68930992643d666a7d26c1f1b067d`
- Store handle: `cfbexf-h4.myshopify.com`, confirmed through authenticated Shopify CLI 4.5.2
- Authenticated account display name: `Briant Ginty`; Shopify Admin showed the **Basic** plan active on 15 August at the promotional `$1 AUD per month` until 15 November 2026, so the paid-plan gate is passed
- Theme root: repository root
- Shopify CLI: 4.5.2
- Source validation: Theme Check 187/0; structural validation 62/62; Node tests 6/6; copy and one-product data audits passed; production gate validator 21/21 required gates and 23 total gates; dependency audit 0 vulnerabilities; documentation links 50 files/176 references/0 broken; secret scan and diff checks clean
- Shopify upload evidence: existing live `Horizon` theme ID `130871099450` was preserved and untouched. The interim `5cc3edc` strict push ran from 12:48:17 to 12:49:53 AEST on 15 August and failed Shopify schema validation because `templates/index.json` set `products_to_show` below the minimum of 2; it is not a successful upload. Corrected commit `bb41a70d630041e95f627d05c62b7247b04257f7` strictly pushed successfully from `2026-08-15T12:52:11.7607489+10:00` to `2026-08-15T12:53:12.6371436+10:00`. Candidate `Docked Production Candidate 2026-08`, theme ID `130871427130`, remains unpublished; its preview/editor URLs are unchanged.
- Theme-role verification: authenticated CLI theme-list output reverified by 13:02 AEST on 15 August that `Horizon` ID `130871099450` was `live` with `processing: false`, and candidate ID `130871427130` was `unpublished` with `processing: false`; the exact CLI minute before the 13:02 local-clock check was not retained.
- Admin settings evidence: AUD, Australia/Melbourne, metric and kilograms verified; supplied business address and `support@docked.com.au` configured. Notifications now reports **Email domain authentication — Needs setup** and a Shopify backup sender; end-to-end mail tests remain outstanding. Australia is the only active market; new customer accounts are active.
- Catalogue/content evidence: authenticated Admin observation on 15 August found 15 total shells. `Docked Cruise D2`, Shopify product ID `7591990034490`, is the sole shell that remains Draft, with inventory not tracked, channels 0 and vendor `Requires verification`; the other 14 shells were changed to Archived, not deleted. No product is Active and none of the newly supplied AI-generated concept images was uploaded. Seven historical planned collections are empty; three redirects are imported; all 12 planned Shopify Pages exist with their intended template suffixes verified. Six are visible only behind the password and six remain hidden pending applicable approvals. The hidden custom Privacy Policy Page is distinct from Shopify's existing native policy resource, and neither is approved. The six-link Main menu and seven-link existing Footer menu are configured; three named footer-menu resources also exist with recorded IDs.
- Commerce configuration evidence: Australia is collecting through Basic Tax and prices include sales tax, but tax-on-shipping is unchecked and no transaction/invoice testing has run. Unapproved domestic and international rates and delivery-time claims are configured; pickup/delivery are off. Shopify Payments requires completion. PayPal displays Active but its account and test/refund flow are unverified. No test or live transaction exists.
- Rendered evidence: detailed partial manual in-app-browser QA at 320, 360, 375, 390, 768, 1024 and 1440 px applies only to historical uploaded source `5f46487d1f53e45f5706ae945eeb5a09064893e3`. For current one-product commit `bb41a70d630041e95f627d05c62b7247b04257f7`, limited evidence confirms the signed-out/direct preview remains password-protected; the password page displays **“Pool time, powered — soon.”** and D2 Draft wording; and the authenticated Theme Editor lists the one-product homepage composition. The inner homepage, product route, route/menu/contact/account interactions, full multi-browser, screenshot, accessibility, Lighthouse and commerce/browser suite were not run or passed against the current commit.
- Public site: the legacy GitHub Pages finance site remains recoverable and publicly served
- Gate totals: **5 passed; 18 blocked; 0 pending; 0 not applicable**

## Hard stop gates

The exact **DOCKED** business name appeared in the preliminary ASIC public-register search as registered to another holder. This remains a hard blocker for both public prelaunch and live sales. Domain ownership and a zero-result exact trademark quick search do not resolve it. The accepted resolution evidence is a current lawful business-name/brand decision supported by appropriate documentation as described in [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md).

No genuine SKU is currently approved, no exact-SKU licensed product media is supplied, no product compliance or insurance is evidenced, and no final price, tracked stock or approved shipping is available. Supplier files received on 15 August are component-level review material only: they do not establish the exact finished lounger, its two-battery retail configuration, Australian electrical/charger/RCM position, final battery transport classification/carrier acceptance, load capacity, runtime/power/speed claims or media rights. The supplied AI-generated concept images were not uploaded and are not exact-SKU documentary media. Receipt passes no product, media, battery/transport, compliance, price, inventory, shipping, policy, payment, test-order, DNS, business-name or authorisation gate. Payment, tax-invoice, refund, support-mailbox and complete rendered-preview testing have not passed. Accordingly, public sales cannot be authorised.

## Gate register

| Gate | Current state | Minimum passing evidence |
| --- | --- | --- |
| Brand-name resolution | Blocked | Written lawful resolution of the exact-name issue, or a documented cleared replacement brand, reviewed by the appropriate owner/adviser |
| Shopify store created | Passed | Owner-supplied handle plus signed-out rendered Shopify password page at `cfbexf-h4.myshopify.com/password`; this passes existence only |
| Shopify Admin authenticated | Passed | Shopify CLI 4.5.2 authenticated to and returned theme metadata for `cfbexf-h4.myshopify.com`; no credential recorded |
| Storefront password enabled | Passed | Signed-out request redirects to the Shopify password page; reverify immediately before any publication decision |
| Shopify paid plan selected | Passed | Authenticated Admin Plan details showed the Basic plan active on 15 August 2026; this passes only the plan gate |
| Theme preview uploaded | Passed | Current one-product source `bb41a70d630041e95f627d05c62b7247b04257f7` cleanly pushed with `--strict` to unpublished `Docked Production Candidate 2026-08`, ID `130871427130`, after the separately recorded failed `5cc3edc` attempt; permanent preview/editor URLs unchanged and live `Horizon` preserved |
| Rendered QA passed | Blocked | Complete multi-browser/viewport, accessibility and Lighthouse evidence against the permanent preview on exact commit `bb41a70d630041e95f627d05c62b7247b04257f7`; current password-page/editor observations and historical `5f46487…` QA do not pass this gate |
| Support email verified | Blocked | External message sent to the mailbox and received; reply sent from the mailbox and received externally; contact-form, order and refund notifications delivered; SPF, DKIM and DMARC reviewed |
| Approved products available | Blocked | D2 is the only remaining Draft candidate; it still needs an exact SKU with supplier/model, evidence dossier, manual, owner activation approval and all individual gates complete |
| Licensed product media available | Blocked | Exact-SKU media licence register and controlled proof of permission, adult/safety review and model match; supplied AI concept images are not passing evidence and were not uploaded |
| Product compliance approved | Blocked | Applicable classification, safety, electrical/charger/RCM, battery/transport and warning evidence for each proposed Active SKU |
| Product liability insurance reviewed | Blocked | Broker/insurer confirmation covering the exact products, activities, entity and Australian territory |
| Final prices approved | Blocked | Dated owner approval of landed cost, GST-inclusive retail price, margin and any promotion basis per SKU |
| Inventory approved | Blocked | D2 currently has inventory not tracked; passing requires counted saleable stock by SKU/location, inventory tracking on, overselling off and an approval record |
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
