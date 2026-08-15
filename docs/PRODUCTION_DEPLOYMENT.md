# Docked production deployment runbook

Status: **UNPUBLISHED SHOPIFY CANDIDATE UPLOADED — PUBLICATION AND SALES NOT AUTHORISED**
Last updated: 15 August 2026 (Australia/Sydney)

This is the production-control runbook for moving the completed Shopify theme source into a real store. It is not evidence that a store, theme, product, payment method or domain is live. The authoritative machine-readable gate state is [production-launch-gates.json](production-launch-gates.json).

## Release identity

| Field | Recorded value |
| --- | --- |
| Repository | `bginty/docked` (`https://github.com/bginty/docked`) |
| Release branch | `release/docked-shopify-production-2026-08` |
| Starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Current uploaded theme-source commit | `bb41a70d630041e95f627d05c62b7247b04257f7` |
| Current one-product source revision | Committed and strictly pushed to unpublished candidate theme `130871427130`; limited password-page/editor evidence only, full rendered QA blocked |
| Initial brand-refresh uploaded source | `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` |
| Previous exact uploaded source | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Draft pull request | [bginty/docked#1](https://github.com/bginty/docked/pull/1) |
| Source branch | `codex/docked-pool-commerce-rebuild` |
| Theme root | Repository root; contains `assets`, `config`, `layout`, `locales`, `sections`, `snippets` and `templates` |
| Shopify CLI | `4.5.2`, pinned in `package.json` |
| Store handle | `cfbexf-h4.myshopify.com`, confirmed through authenticated Shopify CLI 4.5.2 |
| Unpublished candidate | `Docked Production Candidate 2026-08`, theme ID `130871427130` |
| Existing live Shopify theme | `Horizon`, theme ID `130871099450`; preserved and not modified |
| Public domain | `docked.com.au`, still serving the recoverable GitHub Pages finance site |
| Working mode | `AUTO_MAXIMUM_SAFE_PROGRESS` |

The legacy branch `archive/docked-finance-site-2026-08`, annotated tag `docked-finance-site-before-pool-rebuild`, legacy commit `b26add982e5f4c7cfab2b13f74a14500d7199530`, GitHub Pages project and DNS rollback records must be preserved. Do not rewrite or delete them.

## Verified source baseline

The following results were recorded against the completed source before Shopify deployment preparation. Re-run them on the exact candidate commit before and after any deployment-record changes.

| Check | Recorded result | Command or evidence |
| --- | --- | --- |
| Theme Check | 187 files; 0 offenses | `npm exec shopify theme check -- --path .` |
| Structural validator | 62/62 passed | `npm run validate` |
| Node tests | 6/6 passed | `npm test` |
| Copy audit | Passed | `npm run audit:copy` |
| Data validation | Current working tree passed for one Draft DC-02 catalogue row, one guarded DC-02 pricing row and one safe Draft-import row; the 104-row competitor file remains historical research and the 3 redirects remain valid | Structural validator and repository registers |
| Dependency audit | 0 vulnerabilities | `npm audit --omit=optional` |
| Production gate validator | 21/21 required gates valid; 23 total gates: 5 passed, 18 blocked | `npm run validate:production` |
| Secret scan | 0 high-confidence matches | Recorded release audit; repeat before every push/publication |
| Document link audit | 50 Markdown files; 176 relative references; 0 broken | Excludes intentional external/placeholder targets; repeat after documentation changes |
| Diff check | Clean | `git diff --check` |
| Rendered storefront QA | Partial manual in-app-browser QA completed at 320, 360, 375, 390, 768, 1024 and 1440 px; full automated, multi-browser, accessibility and Lighthouse coverage remains blocked | [Post-launch QA](POST_LAUNCH_QA.md) |

Passing source checks does not pass rendered QA, product, payment, shipping, legal, email, DNS or publication gates.

## Current Shopify access position

- Shopify CLI 4.5.2 is authenticated to `cfbexf-h4.myshopify.com`; the CLI returned the store and theme-library metadata recorded in [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md).
- The authenticated Admin display name is `Briant Ginty`. On 15 August, Admin Plan details showed the **Basic** plan active at the promotional `$1 AUD per month` until 15 November 2026. The paid-plan gate is passed; this does not authorise publication.
- The existing published Shopify theme is `Horizon`, ID `130871099450`. It was observed and preserved; it was not overwritten or republished.
- Authenticated `shopify theme list --json --no-color` reverified by 13:02 AEST on 15 August 2026 that `Horizon` ID `130871099450` had role `live` and `processing: false`, while `Docked Production Candidate 2026-08` ID `130871427130` had role `unpublished` and `processing: false`. The exact CLI minute before the 13:02 local-clock check was not retained; no credentials are recorded.
- The detailed responsive observations in the next bullet apply only to historical commit `5f46487d1f53e45f5706ae945eeb5a09064893e3`; references there to the “current” brand describe the state of that 14 August run, not current commit `bb41a70d630041e95f627d05c62b7247b04257f7`.
- `Docked Production Candidate 2026-08`, ID `130871427130`, remains an **unpublished** theme. A first strict one-product candidate push from interim commit `5cc3edc` ran from 12:48:17 to 12:49:53 AEST on 15 August 2026 and failed Shopify schema validation because `templates/index.json` set `products_to_show` below Shopify's minimum of 2; that attempt was not successful. Corrected commit `bb41a70d630041e95f627d05c62b7247b04257f7` was strictly pushed from `2026-08-15T12:52:11.7607489+10:00` to `2026-08-15T12:53:12.6371436+10:00` and succeeded. Shopify returned store `cfbexf-h4.myshopify.com`, candidate name, role `unpublished`, permanent preview URL `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` and editor URL `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor`. Existing live `Horizon`, ID `130871099450`, remained untouched.
- The storefront password was entered only in the authenticated in-app Browser, allowing the unpublished candidate to render without removing password protection. Historical manual responsive QA ran at 320, 360, 375, 390, 768, 1024 and 1440 px. After historical integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` was pushed, every tested width had document and body `scrollWidth` equal to `innerWidth`. At 320 px, the exact width readings were `320/320/320`; the integrated header wordmark measured `110 × 25.71` px with SVG viewBox `0 0 650 152`, hero art `288 × 345.6` px, the note within the hero `248 × 79.4` px and footer wordmark `220 × 51.44` px. Across 320/360/375/390/768/1024/1440, header wordmark widths were `110/157.575/163.963/180/180/180/180` px and footer wordmark widths were `220/220/220/152/216/220/220` px. At 1440 px, header/footer/hero widths were `180/220/552.14` px and navigation remained intact. The 320 px mobile menu opened with `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` and no overflow. Header/footer home links exposed the accessible name `Docked — home`. The header used navy `#06283D` with cyan `#13BFE6`; the footer showed a white wordmark with cyan wake on scheme 3; the hero showed the navy mark, `18+` seal and complete preview-art accessible label. On the initial brand push, the password page rendered the hidden `Docked` name, theme favicon, H1 and modal; the historical final commit changed only wordmark SVG geometry. The favicon resolved from the theme asset, Organization JSON-LD used an absolute `docked-mark.svg` asset URL, and the historical run's final console contained no errors or warnings. Screenshot/CDP capture timed out, so that historical brand run has geometry, computed-style and DOM evidence only. Full multi-browser, screenshot, accessibility, Lighthouse, product, checkout and delivery testing remains incomplete, so rendered QA is blocked.
- Authenticated Admin inspection verified AUD, Australia/Melbourne, metric and kilograms. The supplied correspondence address and `support@docked.com.au` are configured. On 15 August, Notifications reported **Email domain authentication — Needs setup** and warned that a `shopifyemail.com` backup sender will be used when authentication or DMARC is incomplete. End-to-end inbound, reply and notification delivery evidence remains outstanding. New customer accounts are active with sign-in links enabled; the signed-out entry dialog rendered, but authentication, logout and order history remain untested. Australia is the only active market.
- Historical import record: fifteen deliberately skeletal product concepts were originally imported as Draft with inventory not tracked, no images, no sales-channel publication and no Active products. The seven planned collections were created empty and the three prepared redirects imported successfully.
- On 15 August 2026, authenticated Shopify Admin inspection and reversible catalogue cleanup confirmed 15 total product shells. `Docked Cruise D2` (Shopify product ID `7591990034490`) is the only shell that remains **Draft**; inventory is not tracked, it is published to 0 channels and its vendor remains `Requires verification`. The other 14 shells were changed to **Archived**, not deleted. None is Active, and none of the newly supplied AI-generated concept images was uploaded.
- The repository catalogue and storefront configuration are narrowed to the one planned product at commit `bb41a70d630041e95f627d05c62b7247b04257f7`, now uploaded to unpublished candidate theme `130871427130`. Limited current evidence confirms signed-out/direct preview access remains password-protected; the password page displays the one-product copy **“Pool time, powered — soon.”** and D2 Draft wording; and the authenticated Theme Editor lists the one-product homepage composition. The inner homepage, product route and commerce/browser suite were not run against this commit. All detailed responsive, route and interaction observations for `5f46487d1f53e45f5706ae945eeb5a09064893e3` remain historical only.
- All 12 planned Shopify Pages now exist with their intended template suffixes assigned and verified in Admin. Contact, How It Works, Safety and Care, FAQ, Track Your Order and Accessibility are visible only behind the storefront password. Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy and Terms of Service remain hidden pending their applicable approvals. The hidden custom Privacy Policy Page is distinct from Shopify's existing native `/policies/privacy-policy` resource, which is reachable behind the password but remains unapproved.
- The Main menu is now `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`; those entries rendered on desktop and in the earlier 390 px mobile check, then historical source `5f46487…` was rechecked with the same six-link menu open at 320 px without overflow. The existing Footer menu is now `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`.
- Three additional named Admin resources were created: Footer shopping menu ID `198327042106` with the seven planned collections; Footer support menu ID `198327074874`, duplicated from the support footer; and Footer legal menu ID `198327107642` with only Shopify's existing native Privacy Policy resource. Historical uploaded source commit `5f46487d1f53e45f5706ae945eeb5a09064893e3` mapped **Explore** to `footer-shopping-menu` and **Help and policies** to `footer-support-menu`; its rendered menu observations remain historical and must not be attributed to the current one-product commit. The native policy resource and separate hidden custom Privacy Policy Page remain unapproved; unapproved Terms were intentionally withheld.
- Safety and Care and FAQ now render the candidate content with one H1 each and no 404; the FAQ contains eight items and an accordion interaction passed. A controlled Contact form submission was accepted at `?contact_posted=true` and Shopify displayed its success confirmation. Mailbox receipt remains unverified and Shopify still labels the sender email **Unverified**, so the support-email gate remains blocked.
- The signed-out account button opened Shopify's new customer-account dialog with **Sign in with Shop**, an email form whose submit button remained disabled until an email is entered, a marketing opt-in checkbox and Orders/Profile quick links. No credentials were entered; authentication, errors after submission, logout and order history remain untested, so this is an entry-point partial pass only.
- Australia is collecting through Basic Tax and the prices-include-sales-tax setting is checked. **Charge sales tax on shipping** is currently unchecked. No order, invoice, discount, shipping-tax, cancellation or refund reconciliation has run; the GST gate remains blocked.
- On 15 August, the General shipping profile contained unapproved Domestic Express `$15` / `1–2 business days`, Domestic Standard `$11` or free from `$100` / `3–5 business days`, and Standard international `$20` / `3–5 business days` for a 27-country zone. Carrier accounts show **None**; local delivery and pickup remain off. These rates and delivery claims lack the required owner, carrier, package, remote-area, battery and checkout evidence, and international shipping is not approved for the initial launch. Shopify Payments still says **Complete setup** and requires more business information. PayPal displays **Active**, but the connected account and test/refund behaviour are not verified. No test or live transaction has run.
- Credentials, Theme Access passwords, identity documents, bank information and customer data must never be stored in Git or copied into these records.

## Safe deployment sequence

1. Reconcile the release branch and exact commit without rewriting history. Re-run every source check above.
2. Authenticate to `cfbexf-h4.myshopify.com` through Shopify's supported flow; independently confirm the target store before any write.
3. Inspect the current theme library, published theme and plan. Record their IDs without publishing or deleting anything.
4. Push the repository theme as a **new unpublished** theme named **Docked Production Candidate 2026-08**. This is complete for theme ID `130871427130`; never overwrite the live theme and never use a live-theme or force flag.
5. Capture the CLI response, theme ID, theme role, permanent preview URL and editor URL in [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md). Keep the storefront password-protected.
6. Create only evidence-backed Admin content. Keep Docked Cruise D2 Draft and the 14 superseded shells Archived unless their status is deliberately reviewed; do not delete them. Load draft policies for review but do not call them approved.
7. The validated one-product revision has been committed and strictly pushed to the existing unpublished candidate. Rerun the rendered browser, accessibility, Lighthouse, product, checkout and account suite against exact commit `bb41a70d630041e95f627d05c62b7247b04257f7`. Retain redacted reports and screenshots under `docs/qa/production-preview/`; the detailed partial manual evidence in [Post-launch QA](POST_LAUNCH_QA.md) is historical and does not pass the revised candidate.
8. Close every applicable gate in [Production launch gates](PRODUCTION_LAUNCH_GATES.md) with dated evidence. A template, owner assertion without supporting material or UI appearance alone is not a pass.
9. Resolve the exact **DOCKED** business-name blocker before any public use. See [Business name and trademark](BUSINESS_NAME_AND_TRADEMARK.md).
10. Obtain the relevant exact owner authorisation phrase in the active Codex session. Only then perform the authorised publication mode; enable live payments last.

The candidate was initially created with this supported unpublished-theme command:

```powershell
npm.cmd exec shopify theme push -- --path . --store cfbexf-h4.myshopify.com --unpublished --theme "Docked Production Candidate 2026-08" --json --strict
```

After two Shopify platform validation errors were corrected, the initial clean full push to that independently verified unpublished theme was:

```powershell
npm.cmd exec shopify theme push -- --path . --store cfbexf-h4.myshopify.com --theme 130871427130 --json --strict
```

That initial full command completed successfully by 07:14 AEST on 14 August 2026 with no returned warning or error. A later CSS-only re-push delivered the repaired 320 px wordmark rule, but its exact timestamp was not retained. Historical exact source commit `0b8d127b83d68930992643d666a7d26c1f1b067d` was then pushed strictly to verified unpublished theme `130871427130` from 10:43:36 to 10:44:47 AEST. Initial brand-refresh source `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` and historical integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` were pushed successfully with the same strict candidate command on 14 August 2026 AEST; their exact CLI start/end timestamps were not retained. Shopify returned role `unpublished`, store, theme name, preview URL and editor URL, and live `Horizon` theme `130871099450` remained untouched. Do not treat 07:14 or the older exact-push window as the timestamp of current candidate `bb41a70…`. Do not paste an access token into this command or a tracked file.

For the one-product revision, the `5cc3edc` strict push failed Shopify schema validation and must not be treated as an upload. The corrected `bb41a70d630041e95f627d05c62b7247b04257f7` strict push succeeded during the exact window recorded above. The preview/editor URLs and unpublished role remained unchanged, and live `Horizon` remained untouched.

## Store and content configuration gates

Configure Shopify only after authentication confirms the correct store:

- legal seller `GINTY UNITED INVESTMENTS PTY LTD`, ABN `78 606 187 106`, ACN `606 187 106`;
- Australia, AUD, Australia/Melbourne, kilograms and Australia-only market;
- GST-inclusive consumer pricing using the owner-supplied GST registration fact, followed by qualified review and transaction/invoice tests;
- treat `support@docked.com.au` as verified and launch-ready only after inbound, outbound, reply, contact-form and order/refund-notification tests plus sender-authentication review pass;
- 135 Bamfield Road, Heidelberg Heights VIC 3081, Australia only as **correspondence and authorised returns; no public showroom or walk-in service**;
- no local pickup and no international market at initial launch;
- customer accounts compatible with Dawn v16, followed by signed-out login, logout, order-history, mobile and error-state tests;
- the seven created empty collections and reviewed navigation. The updated six-link Main menu rendered on desktop and in the earlier 390 px mobile check, then was rechecked open at 320 px after historical source `5f46487…`; Explore rendered the seven planned collection links, Help and policies rendered the seven support links, and Shopify's native Privacy policy link rendered separately through `show_policy`; and
- the six hidden pages/policies only after their applicable content, legal and business-name approvals. All 12 intended template suffixes are assigned. The three semantically valid legacy redirects are imported: `/index.html` reached the homepage, `/privacy.html` reached Shopify's privacy policy, and `/about.html` correctly targets the intentionally hidden About Docked page but therefore remains a 404 until the business-name gate permits that page to be made visible.

Canonical setup details remain in [Shopify Admin setup](SHOPIFY_ADMIN_SETUP.md), [SEO migration](SEO_MIGRATION.md), [GST and tax-invoice QA](GST_AND_TAX_INVOICE_QA.md), [Payments setup](PAYMENTS_SETUP.md), [Shipping setup](SHIPPING_SETUP.md) and [Asset licences](ASSET_LICENCES.md).

## Product and sales stop rules

Docked Cruise D2 is the sole planned product and remains Draft; the other 14 historical concept shells are Archived and recoverable. D2 may become Active only after the full evidence in [SKU approval workflow](SKU_APPROVAL_WORKFLOW.md), [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md), [Compliance register](COMPLIANCE_REGISTER.md), [Product classification register](PRODUCT_CLASSIFICATION_REGISTER.md), [Approved product claims](APPROVED_PRODUCT_CLAIMS.md), [Price approval register](PRICE_APPROVAL_REGISTER.md) and [Asset licences](ASSET_LICENCES.md) has passed.

Supplier documents received on 15 August are component-level review material only. Receipt does not establish the exact finished lounger, its two-battery retail configuration, Australian electrical/charger/RCM position, battery transport classification and carrier acceptance, load capacity, runtime/power/speed claims, media rights, final price, stock, shipping or insurance. The supplied AI-generated concept images are not licensed exact-SKU documentary photography and were not uploaded. These materials do not pass any product, media, compliance, battery/transport, price, inventory, shipping, policy, payment, test-order, DNS, business-name or authorisation gate.

Do not invent stock, packed measures, rates, claims, images, urgency, reviews, compare-at prices, payment availability or dispatch promises. If no SKU passes, keep all products Draft and checkout unavailable.

## Publication authority

This runbook is not publication authority. The only accepted phrases are:

- `AUTHORISE_DOCKED_PUBLIC_PRELAUNCH` — only after the business-name issue is resolved; permits an approved public coming-soon/catalogue experience with sales, checkout and live capture disabled and unapproved products Draft.
- `AUTHORISE_DOCKED_DOMAIN_CUTOVER_AND_LIVE_SALES` — only after every applicable gate is already passed; permits the approved domain cutover, theme publication, approved SKU activation, password removal and verified live capture.

Neither phrase has been received. Do not infer authority from this project prompt, successful testing, domain access, store ownership, a bank account, an Active product or a published theme.

## Current maximum-safe-progress boundary

Repository preparation and the authenticated **unpublished, password-protected** candidate upload are complete safe independent work. At the current evidence state, do not:

- publish the theme or any product;
- remove password protection;
- enable or test live capture with a real card or PayPal transaction;
- change production DNS;
- alter mail DNS;
- merge the release branch; or
- delete or replace the legacy deployment.

The exact remaining owner-controlled actions and evidence requirements are consolidated in [Production launch gates](PRODUCTION_LAUNCH_GATES.md). Rollback controls are in [Production rollback](PRODUCTION_ROLLBACK.md).
