# Docked production deployment runbook

Status: **UNPUBLISHED SHOPIFY CANDIDATE UPLOADED — PUBLICATION AND SALES NOT AUTHORISED**
Last updated: 14 August 2026 (Australia/Sydney)

This is the production-control runbook for moving the completed Shopify theme source into a real store. It is not evidence that a store, theme, product, payment method or domain is live. The authoritative machine-readable gate state is [production-launch-gates.json](production-launch-gates.json).

## Release identity

| Field | Recorded value |
| --- | --- |
| Repository | `bginty/docked` (`https://github.com/bginty/docked`) |
| Release branch | `release/docked-shopify-production-2026-08` |
| Starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Release-preparation/theme-source commit | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
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
| Theme Check | 186 files; 0 offenses | `npm exec shopify theme check -- --path .` |
| Structural validator | 57/57 passed | `npm run validate` |
| Node tests | 5/5 passed | `npm test` |
| Copy audit | Passed | `npm run audit:copy` |
| Data validation | Passed for 15 Draft catalogue rows, 104 competitor rows, 15 pricing rows and 3 redirects | Structural validator and repository registers |
| Dependency audit | 0 vulnerabilities | `npm audit --omit=optional` |
| Production gate validator | 21/21 required gates valid; 23 total gates: 4 passed, 19 blocked | `npm run validate:production` |
| Secret scan | 0 high-confidence matches | Recorded release audit; repeat before every push/publication |
| Document link audit | 48 Markdown files; 172 relative references; 0 broken | Excludes two intentional `(url)` placeholders in the upstream pull-request template; repeat after documentation changes |
| Rendered storefront QA | Partial manual in-app-browser QA completed at 320, 360, 375, 390, 768, 1024 and 1440 px; full automated, multi-browser, accessibility and Lighthouse coverage remains blocked | [Post-launch QA](POST_LAUNCH_QA.md) |

Passing source checks does not pass rendered QA, product, payment, shipping, legal, email, DNS or publication gates.

## Current Shopify access position

- Shopify CLI 4.5.2 is authenticated to `cfbexf-h4.myshopify.com`; the CLI returned the store and theme-library metadata recorded in [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md).
- The authenticated Admin display name is `Briant Ginty`. Admin showed a trial ending in 3 days and the actions **Subscribe for $1** / **Select a plan**, so the paid-plan gate remains blocked.
- The existing published Shopify theme is `Horizon`, ID `130871099450`. It was observed and preserved; it was not overwritten or republished.
- `Docked Production Candidate 2026-08`, ID `130871427130`, was created and fully pushed as an **unpublished** theme. A strict push of exact release-preparation commit `0b8d127b83d68930992643d666a7d26c1f1b067d` ran from 10:43:36 to 10:44:47 AEST on 14 August 2026; Shopify returned the verified store, unpublished role, candidate name, permanent preview URL `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` and editor URL `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor`.
- The storefront password was entered only in the authenticated in-app Browser, allowing the unpublished candidate to render without removing password protection. Manual responsive QA ran at 320, 360, 375, 390, 768, 1024 and 1440 px. A real 320 px horizontal-overflow defect was found, repaired by constraining the mobile wordmark to `11rem`, re-pushed to theme `130871427130`, and retested with no overflow. After the exact-commit push, the candidate measured `innerWidth=390` and `scrollWidth=390`; the mobile menu opened and showed the updated exact six links `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`. Core home, collection, cart, contact and 404 routes plus mobile menu, search, predictive search, cart drawer and desktop navigation passed within this limited browser run. Full multi-browser, accessibility, Lighthouse, product, checkout and delivery testing remains incomplete, so rendered QA is blocked.
- Authenticated Admin inspection verified AUD, Australia/Melbourne, metric and kilograms. The supplied correspondence address and `support@docked.com.au` were configured. After the owner's mailbox-setup report, Notifications was rechecked: the sender textbox still contained `support@docked.com.au` and Shopify still reported **Unverified**. A fresh verification email was requested at approximately 11:06 AEST and Shopify confirmed **Verification email sent**; owner completion and end-to-end delivery evidence remain outstanding. New customer accounts are active with sign-in links enabled; the signed-out entry dialog rendered, but authentication, logout and order history remain untested. Australia is the only active market.
- Fifteen deliberately skeletal product concepts were imported as Draft with inventory not tracked, no images, no sales-channel publication and no Active products. The seven planned collections were created empty and the three prepared redirects imported successfully.
- All 12 planned Shopify Pages now exist with their intended template suffixes assigned and verified in Admin. Contact, How It Works, Safety and Care, FAQ, Track Your Order and Accessibility are visible only behind the storefront password. Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy and Terms of Service remain hidden pending their applicable approvals. The hidden custom Privacy Policy Page is distinct from Shopify's existing native `/policies/privacy-policy` resource, which is reachable behind the password but remains unapproved.
- The Main menu is now `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`; after the exact-commit push those entries rendered on desktop and in the opened 390 px mobile menu. The existing Footer menu is now `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`.
- Three additional named Admin resources were created: Footer shopping menu ID `198327042106` with the seven planned collections; Footer support menu ID `198327074874`, duplicated from the support footer; and Footer legal menu ID `198327107642` with only Shopify's existing native Privacy Policy resource. Exact release commit `0b8d127b83d68930992643d666a7d26c1f1b067d` maps **Explore** to `footer-shopping-menu` and **Help and policies** to `footer-support-menu`; after the strict push, Explore rendered `Powered Pool Floats`, `Adult Pool Loungers`, `Adult Pool Games`, `Floating Bars and Coolers`, `Pumps, Care and Repair`, `Pool Party Bundles`, `Shop All`, while Help and policies rendered `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`. The native Privacy policy link rendered separately through `show_policy`. The `footer-legal-menu` Admin resource is not mapped or rendered. The native policy resource and separate hidden custom Privacy Policy Page remain unapproved; unapproved Terms were intentionally withheld.
- Safety and Care and FAQ now render the candidate content with one H1 each and no 404; the FAQ contains eight items and an accordion interaction passed. A controlled Contact form submission was accepted at `?contact_posted=true` and Shopify displayed its success confirmation. Mailbox receipt remains unverified and Shopify still labels the sender email **Unverified**, so the support-email gate remains blocked.
- The signed-out account button opened Shopify's new customer-account dialog with **Sign in with Shop**, an email form whose submit button remained disabled until an email is entered, a marketing opt-in checkbox and Orders/Profile quick links. No credentials were entered; authentication, errors after submission, logout and order history remain untested, so this is an entry-point partial pass only.
- GST collection for Australia is enabled with the owner-supplied ABN and the Admin setting indicating prices include sales tax was observed checked. No order, invoice, discount, shipping-tax, cancellation or refund reconciliation has run; the GST gate remains blocked.
- Unapproved domestic and international rates were removed. The Domestic Australia zone remains with no rates, the international zone was deleted, and local delivery and pickup are off. Shopify Payments is not set up, no payment provider or test mode is active, and no transaction has run. These safety states prevent shipping and payment gates from passing.
- Credentials, Theme Access passwords, identity documents, bank information and customer data must never be stored in Git or copied into these records.

## Safe deployment sequence

1. Reconcile the release branch and exact commit without rewriting history. Re-run every source check above.
2. Authenticate to `cfbexf-h4.myshopify.com` through Shopify's supported flow; independently confirm the target store before any write.
3. Inspect the current theme library, published theme and plan. Record their IDs without publishing or deleting anything.
4. Push the repository theme as a **new unpublished** theme named **Docked Production Candidate 2026-08**. This is complete for theme ID `130871427130`; never overwrite the live theme and never use a live-theme or force flag.
5. Capture the CLI response, theme ID, theme role, permanent preview URL and editor URL in [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md). Keep the storefront password-protected.
6. Create only evidence-backed Admin content. Keep all product concepts Draft. Load draft policies for review but do not call them approved.
7. Complete the remaining rendered browser, accessibility, Lighthouse, product, checkout and account suite against the permanent preview. Retain redacted reports and screenshots under `docs/qa/production-preview/`; the current partial manual evidence is catalogued in [Post-launch QA](POST_LAUNCH_QA.md).
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

That initial full command completed successfully by 07:14 AEST on 14 August 2026 with no returned warning or error. A later CSS-only re-push delivered the repaired 320 px wordmark rule, but its exact timestamp was not retained. The exact release-preparation commit `0b8d127b83d68930992643d666a7d26c1f1b067d` was then pushed strictly to verified unpublished theme `130871427130` from 10:43:36 to 10:44:47 AEST; Shopify returned role `unpublished`, store, theme name, preview URL and editor URL. Do not treat 07:14 as the timestamp of the current candidate state. Do not paste an access token into this command or a tracked file.

## Store and content configuration gates

Configure Shopify only after authentication confirms the correct store:

- legal seller `GINTY UNITED INVESTMENTS PTY LTD`, ABN `78 606 187 106`, ACN `606 187 106`;
- Australia, AUD, Australia/Melbourne, kilograms and Australia-only market;
- GST-inclusive consumer pricing using the owner-supplied GST registration fact, followed by qualified review and transaction/invoice tests;
- treat `support@docked.com.au` as verified and launch-ready only after inbound, outbound, reply, contact-form and order/refund-notification tests plus sender-authentication review pass;
- 135 Bamfield Road, Heidelberg Heights VIC 3081, Australia only as **correspondence and authorised returns; no public showroom or walk-in service**;
- no local pickup and no international market at initial launch;
- customer accounts compatible with Dawn v16, followed by signed-out login, logout, order-history, mobile and error-state tests;
- the seven created empty collections and reviewed navigation. After the exact-commit push, the updated six-link Main menu rendered on desktop and in the opened 390 px mobile menu; Explore rendered the seven planned collection links, Help and policies rendered the seven support links, and Shopify's native Privacy policy link rendered separately through `show_policy`; and
- the six hidden pages/policies only after their applicable content, legal and business-name approvals. All 12 intended template suffixes are assigned. The three semantically valid legacy redirects are imported: `/index.html` reached the homepage, `/privacy.html` reached Shopify's privacy policy, and `/about.html` correctly targets the intentionally hidden About Docked page but therefore remains a 404 until the business-name gate permits that page to be made visible.

Canonical setup details remain in [Shopify Admin setup](SHOPIFY_ADMIN_SETUP.md), [SEO migration](SEO_MIGRATION.md), [GST and tax-invoice QA](GST_AND_TAX_INVOICE_QA.md), [Payments setup](PAYMENTS_SETUP.md), [Shipping setup](SHIPPING_SETUP.md) and [Asset licences](ASSET_LICENCES.md).

## Product and sales stop rules

All 15 concepts remain Draft. An individual SKU may become Active only after the full evidence in [SKU approval workflow](SKU_APPROVAL_WORKFLOW.md), [Product evidence checklist](PRODUCT_EVIDENCE_CHECKLIST.md), [Compliance register](COMPLIANCE_REGISTER.md), [Product classification register](PRODUCT_CLASSIFICATION_REGISTER.md), [Approved product claims](APPROVED_PRODUCT_CLAIMS.md), [Price approval register](PRICE_APPROVAL_REGISTER.md) and [Asset licences](ASSET_LICENCES.md) has passed.

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
