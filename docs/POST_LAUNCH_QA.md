# Docked rendered preview and post-launch QA

Status: **PARTIAL PREVIEW QA COMPLETE — FULL RENDERED GATE AND PUBLIC LAUNCH BLOCKED**
Last updated: 14 August 2026 (Australia/Sydney)

This file records actual rendered evidence only after a permanent Shopify preview or authorised public release exists. Prepared tests and target scores are not passing results. The current source baseline passed Theme Check (187 files/0 offenses), structural validation (58/58), production gate validation (21/21 required gates; 23 total with 4 passed and 19 blocked), Node tests (6/6), copy/data audit, dependency audit (0 vulnerabilities), document-link audit (48 files/172 references/0 broken, excluding two intentional upstream pull-request-template placeholders), secret scan and diff checks. A permanent unpublished candidate exists and partial manual in-app-browser QA has run. Full multi-browser, accessibility, Lighthouse, product, checkout, contact-delivery and commerce QA has not passed.

## Target identity

| Field | Current value |
| --- | --- |
| Store | `cfbexf-h4.myshopify.com`, confirmed through authenticated Shopify CLI 4.5.2 |
| Release branch | `release/docked-shopify-production-2026-08` |
| Starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Current uploaded theme-source commit | `5f46487d1f53e45f5706ae945eeb5a09064893e3` |
| Initial brand-refresh uploaded source | `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` |
| Previous exact uploaded source | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Theme ID/name | `130871427130` / `Docked Production Candidate 2026-08` (unpublished) |
| Permanent preview URL | `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` |
| Preview QA observation window/operator | 14 August 2026 AEST. Historical timestamped screenshot artefacts span 08:41–10:11; the older exact-source push ran 10:43:36–10:44:47. The current brand-refresh push and subsequent rendered observations completed later that date, but exact CLI/action times were not retained / Codex using the authenticated in-app Browser |
| Public domain | `docked.com.au`, still the legacy GitHub Pages site |
| Public launch timestamp/operator | Not applicable |

Do not commit a preview URL if it embeds a secret. A redacted URL and theme ID are sufficient in Git; retain authenticated details in the controlled evidence location.

## Preview execution procedure

For the remaining automated suite, set the URL locally only when its access context can reach the candidate:

```powershell
$env:SHOPIFY_PREVIEW_URL='<actual permanent Shopify preview URL>'
npm run test:storefront
```

Do not save the environment variable in a tracked file. Run against the exact candidate theme and commit, signed out where possible, with the store password protections intact. Save redacted screenshots, machine reports and the test manifest under `docs/qa/production-preview/` when generated.

Current execution result: **Partial manual QA completed.** The storefront password was entered only in the authenticated in-app Browser; password protection was not removed. `npm run test:storefront` was attempted with the permanent preview URL, but the runner stopped before launching a browser or executing any assertion because the Playwright package is not installed. That attempt is a blocked preflight, not an automated test result; the isolated runner also does not share the authenticated in-app-browser password context.

## Required browser and viewport matrix

| Platform/browser | 320 | 360 | 375 | 390 | 768 | 1024 | 1440 | Status/evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Codex in-app Browser (real browser engine; exact engine/version not recorded) | Pass after fix and current-brand recheck | Pass | Pass | Pass | Pass | Pass | Pass | Current brand-refresh run had `scrollWidth` equal to `innerWidth` at every width; screenshot capture timed out |
| Current Chrome | Required | Required | Required | Required | Required | Required | Required | Not run |
| Current Edge | Representative | Representative | Representative | Representative | Required | Required | Required | Not run |
| Current Firefox | Representative | Representative | Representative | Representative | Required | Required | Required | Not run |
| Android Chrome | Required where device/emulation available | Required | Required | Required | Required | — | — | Not run |
| Desktop Safari/WebKit equivalent | — | — | — | — | Required | Required | Required | Not run |
| Mobile Safari/WebKit equivalent | Required | Required | Required | Required | Required | — | — | Not run |

Record actual browser/engine versions, physical device versus emulation, OS, viewport, theme ID, commit and timestamp. Do not report Safari itself if only a WebKit equivalent was used.

Saved evidence:

- [Homepage at 320 px](qa/production-preview/homepage-320.png)
- [Homepage at 768 px](qa/production-preview/homepage-768.png)
- [Homepage at 1440 px](qa/production-preview/homepage-1440.png)
- [Home route capture (historical filename; actual file is 1424 px wide and is not 390 px evidence)](qa/production-preview/home-390.png)
- [Powered Pool Floats collection capture (historical filename; actual file is 1424 px wide and is not 390 px evidence)](qa/production-preview/powered-collection-390.png)
- [Safety and Care historical pre-fix 404 capture (historical filename; actual file is 1424 px wide and is not 390 px evidence)](qa/production-preview/safety-390.png)
- [Safety and Care after page/template creation](qa/production-preview/safety-current-desktop.jpg)
- [FAQ with rendered questions](qa/production-preview/faq-current-desktop.jpg)
- [Contact form Shopify success confirmation](qa/production-preview/contact-success-current-desktop.jpg)
- [Unknown-route 404 capture (historical filename; actual file is 1424 px wide and is not 390 px evidence)](qa/production-preview/not-found-390.png)

The Safety and Care screenshot records the earlier missing-page regression and is not the current route result. The four retained files whose names end in `-390.png` are 1424 px wide; their filenames are historical only and they must not be used as proof of a 390 px viewport. Current post-fix page, FAQ and Contact-form observations are recorded in [the machine-readable rendered QA summary](qa/production-preview/rendered-qa.json).

The initial 320 px run found horizontal overflow. The mobile wordmark was constrained to `11rem`, the candidate was re-pushed to theme `130871427130`, and the 320 px retest passed with no horizontal overflow. Following the current integrated one-word push, a fresh seven-width run also found no viewport overflow: every tested width had document/body `scrollWidth` equal to `innerWidth`, with exact 320 px viewport/document/body readings of `320/320/320`. At 320 px the header/hero/note/footer measured `110 × 25.71`, `288 × 345.6`, `248 × 79.4` and `220 × 51.44` px; the wordmark viewBox was `0 0 650 152`. Header widths at 320/360/375/390/768/1024/1440 were `110/157.575/163.963/180/180/180/180` px, and footer widths were `220/220/220/152/216/220/220` px. At 1440 px the header/footer/hero widths were `180/220/552.14` px. Screenshot/CDP capture timed out, so the latest brand run is recorded as DOM, geometry and computed-style evidence only; no new screenshot artifact was created.

## Functional and content record

| Area | Actual result | Limits / evidence |
| --- | --- | --- |
| Homepage and header | Pass in the in-app Browser | Tested at all seven required widths; current header main fill navy `#06283D`, wake cyan `#13BFE6`; 320 px integrated wordmark measured `110 × 25.71` px with viewBox `0 0 650 152`; older screenshots above, no new screenshot from latest run |
| Desktop navigation | Pass in the in-app Browser | Updated Main menu rendered with `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` |
| Mobile menu | Pass in the in-app Browser after current brand push | At 320 px with `innerWidth` / document `scrollWidth` / body `scrollWidth` of `320/320/320`, the menu opened and showed `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` without overflow |
| Footer navigation | Pass for mapped candidate blocks after exact-commit push | Explore rendered `Powered Pool Floats`, `Adult Pool Loungers`, `Adult Pool Games`, `Floating Bars and Coolers`, `Pumps, Care and Repair`, `Pool Party Bundles`, `Shop All`. Help and policies rendered `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`. Native Privacy policy rendered separately through `show_policy`; `footer-legal-menu` remains unused and did not render |
| Search and predictive search | Pass in the in-app Browser | Manual interaction passed; exhaustive search-result relevance not assessed |
| Collections | Partial pass | Powered Pool Floats empty collection route rendered; all seven planned collections are empty; filter/sort/pagination behaviour was not testable |
| Product page/gallery/variants/quantity | Not run | All 15 products are Draft, channels 0, with no images; no candidate product route is available |
| Product/adult/safety warnings | Partial pass | Safety and Care renders candidate safety content and warnings with one H1; no approved product route exists, so card/purchase-control/product-detail warnings remain untested |
| Draft-product safeguard | Pass for observed state | All 15 concepts are Draft, channels 0, inventory not tracked and unavailable for purchase |
| Cart | Partial pass | Empty cart route and cart drawer passed; add, quantity, remove and multi-item flows were unavailable |
| Checkout | Disabled as intended for current state | Checkout controls were disabled; no checkout entry, shipping, GST, payment or order test ran |
| Contact | Submission accepted; mailbox delivery not verified | Shopify accepted a controlled submission at `?contact_posted=true` and displayed **Thanks for contacting us**; this does not prove receipt by `support@docked.com.au` |
| FAQ and Safety and Care | Partial pass | Both candidate templates render with one H1 and no 404; FAQ contains eight items and an accordion opened successfully |
| 404 | Pass in the in-app Browser | Unknown route rendered the intended 404; screenshot retained above |
| Customer accounts | Partial entry-point pass | Signed-out account button opened Shopify's new account dialog with Sign in with Shop, email form (submit disabled until email), marketing opt-in and Orders/Profile quick links. No credentials were entered; authentication, post-submit errors, logout and order history remain untested |
| Brand asset rendering | Partial pass in the in-app Browser | Header/footer home links exposed accessible name `Docked — home`; footer wordmark rendered white with cyan wake on scheme 3; 320 px footer wordmark measured `220 × 51.44` px. Favicon resolved from the theme asset and Organization JSON-LD used an absolute `docked-mark.svg` asset URL. The password page rendered the hidden `Docked` name, favicon, H1 and modal on the initial brand push; final source changed only wordmark geometry |
| Hero brand art | Partial pass in the in-app Browser | At 320 px the hero art measured `288 × 345.6` px and its note `248 × 79.4` px; navy mark, `18+` seal and complete preview-art accessible label were present. At 1440 px hero width was `552.14` px. This is not a substitute for the full accessibility audit |
| Responsive overflow | Pass after repair in the tested in-app Browser | Real 320 px defect fixed with `11rem` mobile wordmark and retested; after the current brand push all seven widths had matching `innerWidth`/`scrollWidth`, including exact 320 px viewport/document/body readings of `320/320/320` |
| Images/runtime output | Pass on tested routes | No broken images, console errors, console warnings, Liquid errors or mixed content observed on tested routes |
| Legacy finance copy | Pass on tested routes | None observed on the tested candidate routes; favicon and Organization JSON-LD logo were checked, but the full sitemap/metadata/structured-data audit remains incomplete |
| Claims/payment badges/urgency | Not fully audited | No product route exists; do not infer a full content pass from the limited routes |
| AUD/GST-inclusive prices | Not run in rendered commerce | No Active product price or checkout/invoice flow exists |
| International/local service | Disabled in Admin | International shipping zone deleted; local delivery and pickup off; Domestic Australia has no rates |

## Accessibility record

Status: **Partial visual responsive/reflow inspection only; accessibility not passed**.

Test WCAG 2.2 AA-relevant keyboard operation, landmarks/headings, accessible names, errors, live regions, drawers/dialogs, contrast, 200%/400% zoom, reflow at 320px, reduced motion, image alternatives and representative screen-reader flows. Record tooling and manual results; an automated scan alone is not a pass.

| Route | Automated result | Keyboard/manual result | Screen reader | Evidence |
| --- | --- | --- | --- | --- |
| Home | Not run | Responsive/reflow visual observation at 320–1440 px; header/footer home accessible names and hero-art label inspected, but keyboard audit not run | Not run | Manual Browser DOM/geometry observations and the truthfully qualified older screenshots listed above |
| Collection | Not run | Route rendered; no reliable 390 px screenshot was retained and keyboard audit was not run | Not run | `qa/production-preview/powered-collection-390.png` is 1424 px wide despite its historical filename |
| Product | Not run | Not run | Not run |  |
| Cart | Not run | Not run | Not run |  |
| Safety and Care | Not run | Candidate content/warnings rendered with one H1; keyboard audit not run | Not run | `qa/production-preview/rendered-qa.json`; the PNG is historical pre-fix evidence |
| Password/prelaunch | Not run | Not run | Not run |  |
| 404 | Not run | Branded 404 rendered; no reliable 390 px screenshot was retained and keyboard audit was not run | Not run | `qa/production-preview/not-found-390.png` is 1424 px wide despite its historical filename |

## Lighthouse record

Record actual mobile/desktop Performance, Accessibility, Best Practices and SEO scores, tool/version, run count, throttling and URL. Do not enter targets as results.

| Route/profile | Performance | Accessibility | Best Practices | SEO | Evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Homepage mobile | Not run | Not run | Not run | Not run |  |
| Homepage desktop | Not run | Not run | Not run | Not run |  |
| Product mobile | Not run | Not run | Not run | Not run |  |
| Product desktop | Not run | Not run | Not run | Not run |  |
| Collection mobile | Not run | Not run | Not run | Not run |  |
| Cart mobile | Not run | Not run | Not run | Not run |  |
| Safety page | Not run | Not run | Not run | Not run |  |

## Commerce and notification QA

Use Shopify-supported test mode/test gateway and approved test SKUs only. Never use a real card or real PayPal transaction without separate explicit authority.

| Scenario | Status | Evidence required |
| --- | --- | --- |
| Approved powered product, if one exists | Not run | Product/order/inventory/shipping/warning record |
| Approved non-powered product, if one exists | Not run | Product/order/inventory/shipping/warning record |
| Multi-item and quantity >1 | Not run | Cart/order totals and inventory reconciliation |
| Genuine discount, if planned | Not run | Discount basis and GST reconciliation |
| Melbourne, Sydney, Brisbane, Adelaide and Perth metro shipping | Not run | Rate, tax and service result |
| Regional Victoria and supported remote postcode | Not run | Acceptance/exclusion, rate and wording |
| Successful and declined payment | Not run | Redacted provider/order status |
| Cancellation, full refund and applicable partial refund | Not run | Payment, order, inventory, GST, invoice and notification reconciliation |
| Tax Invoice | Not run | Automatic delivery with legal seller and ABN; qualified review |
| Customer and staff notifications | Not run | Redacted delivery records |
| Account order history/status page | Not run | Signed-out/signed-in flow evidence |

## Support email QA

The mailbox gate requires end-to-end delivery evidence in both directions; DNS records or a visible address alone are not a pass.

| Scenario | Status | Passing evidence |
| --- | --- | --- |
| External message to `support@docked.com.au` | Attempt blocked before send: connected Gmail account reported **Mail service not enabled** | External sender record plus receipt in the support mailbox |
| Reply from `support@docked.com.au` | Not run | Sent-mail record plus receipt by the external sender |
| Contact-form delivery | Shopify accepted controlled submission at `?contact_posted=true` and showed its success confirmation; mailbox receipt unverified | Shopify submission result plus receipt in the support mailbox |
| Order-notification delivery | Not run | Redacted test-order notification and mailbox receipt |
| Refund-notification delivery | Not run | Redacted test-refund notification and mailbox receipt |
| Sender-domain authentication | Admin Notifications rechecked after the owner's setup report: textbox `support@docked.com.au`, status still **Unverified**. A fresh verification email was requested at approximately 11:06 AEST and Shopify confirmed **Verification email sent** | Owner completes the verification link; delivered-message headers and provider configuration review |
| SPF | DNS observed; operational result not tested | Alignment/authentication result from delivered-message headers |
| DKIM | Unverified | Selector/provider evidence plus delivered-message signature result |
| DMARC | DNS observed; operational result not tested | Alignment result and policy review for the actual sender |

## Public post-launch smoke test

Run this section immediately after an authorised public release, without placing a real order unless separately authorised. Current state: **Not applicable; no launch occurred**.

Verify apex and `www`, HTTPS/TLS, primary redirect, home, navigation, collections, only approved Active products, search, cart, checkout entry/mode, enabled payment display, shipping, GST, contact, support email, policies, Safety and Care, mobile menu, 404, legacy redirects, unrelated legacy route 404s, sitemap, robots, canonicals, structured data, Open Graph, console, images, links, performance and accessibility. Confirm old finance content is no longer served only after the new release is actually public.

Record every failure with severity, owner, reproduction, evidence and disposition. If a critical theme, commerce or DNS failure meets the agreed threshold, use [Production rollback](PRODUCTION_ROLLBACK.md); do not improvise a destructive rollback.

## Current conclusion

Partial manual rendered QA passed the tested candidate routes and responsive widths after one repaired 320 px overflow defect. Current integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` was strictly pushed to the same unpublished candidate; subsequent Browser observations found no overflow at all seven widths, verified the 320 px mobile navigation, accessible header/footer home names, navy/cyan/white logo presentation, hero `18+` treatment, theme favicon and absolute Organization JSON-LD logo URL, and found no console errors or warnings. Screenshot/CDP capture timed out, so there is no new screenshot artifact for this latest brand run. Earlier menu, route, Safety and Care, eight-item FAQ and controlled Contact observations remain recorded, but mailbox receipt is unverified and Shopify still marks the sender **Unverified**. Full rendered QA, visual screenshot coverage, accessibility, Lighthouse, product, checkout, GST/invoice, email and live-site smoke tests are **not passed**. The theme cannot be published and live sales cannot be enabled on this evidence. See [Production launch gates](PRODUCTION_LAUNCH_GATES.md) and [Shopify deployment record](SHOPIFY_DEPLOYMENT_RECORD.md).
