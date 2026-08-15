# Docked Shopify deployment record

Status: **ONE-PRODUCT CANDIDATE UPLOADED — LIMITED PASSWORD-PAGE/EDITOR EVIDENCE; FULL RENDERED QA AND LAUNCH BLOCKED**
Last updated: 15 August 2026 (Australia/Sydney)

This record contains non-sensitive Shopify deployment metadata only. It must never contain credentials, Theme Access passwords, Admin tokens, bank information, identity documents, full payment data or customer data.

## Release candidate

| Field | Value / state |
| --- | --- |
| Repository | `bginty/docked` |
| Release branch | `release/docked-shopify-production-2026-08` |
| Starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Current uploaded theme-source commit | `bb41a70d630041e95f627d05c62b7247b04257f7` |
| Current one-product source revision | Committed and strictly pushed to candidate theme `130871427130`; limited password-page/editor evidence only, full rendered QA blocked |
| Initial brand-refresh uploaded source | `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` |
| Previous exact uploaded source | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Draft pull request | [bginty/docked#1](https://github.com/bginty/docked/pull/1) |
| Theme root | Repository root |
| Candidate theme name | `Docked Production Candidate 2026-08` |
| Shopify CLI | 4.5.2 |
| Store handle | `cfbexf-h4.myshopify.com` — confirmed through authenticated Shopify CLI 4.5.2 |
| Shop domain | `cfbexf-h4.myshopify.com` |
| Store ID | Not available |
| Plan | **Basic** active; Admin showed the promotional `$1 AUD per month` until 15 November 2026; paid-plan gate passed |
| Authenticated account | `Briant Ginty` (safe Admin display name); Shopify CLI session authenticated |
| Theme ID | `130871427130` |
| Theme role | `unpublished` |
| Permanent preview URL | `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` |
| Theme editor URL | `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor` |
| Previous/current live Shopify theme | `Horizon`, ID `130871099450`; preserved and unmodified |
| Published Docked theme | None evidenced |
| Storefront password | Enabled after the one-product push: signed-out/direct preview remained password-protected and displayed **“Pool time, powered — soon.”** plus D2 Draft wording |

## Authenticated discovery record

The repository contains a valid Shopify Online Store 2.0 theme at its root. Shopify CLI 4.5.2 authenticated through Shopify's supported flow and confirmed `cfbexf-h4.myshopify.com`. Theme-library inspection identified the existing published `Horizon` theme, ID `130871099450`; it was preserved and not changed.

After authentication refresh, `shopify theme list --json --no-color` was reverified by 13:02 AEST on 15 August 2026. It returned `Horizon` ID `130871099450` with role `live` and `processing: false`, and `Docked Production Candidate 2026-08` ID `130871427130` with role `unpublished` and `processing: false`. The exact CLI minute before the 13:02 local-clock check was not retained. No credential is recorded.

A signed-out browser request resolves to the Shopify password page and displays **Docked — Opening soon**. The storefront password was entered only in the authenticated in-app Browser, allowing candidate theme `130871427130` to be rendered for partial QA without removing password protection. This verifies store existence, password protection, candidate rendering and the CLI theme metadata. A Basic paid plan was separately verified on 15 August; neither fact verifies legal identity or launch readiness.

Authenticated Admin inspection confirmed AUD, Australia/Melbourne, metric units and kilograms. The supplied correspondence address and `support@docked.com.au` are configured; email-domain authentication still reports **Needs setup**. Australia is the only active market and new customer accounts are active. A Basic plan is active, but no publication, product activation, completed Shopify Payments setup or custom-domain connection is recorded.

## Pre-upload verification

- [x] Authenticate through Shopify's supported browser flow.
- [x] Confirm the current store is exactly `cfbexf-h4.myshopify.com` before the unpublished write.
- [x] Confirm a paid plan without copying billing details: authenticated Admin showed Basic active on 15 August 2026. Store ID and legal-business verification remain separate launch evidence.
- [x] Record the current published Shopify theme name/ID and preserve it.
- [x] Use an unpublished creation flow and exact candidate ID; no publish, live overwrite or force flag was used.
- [x] Re-run Theme Check (187 files, 0 offenses).
- [x] Re-run structural validation (62/62), production gate validation (21/21 required; 23 total) and Node tests (6/6).
- [x] Re-run copy/data audits, dependency audit, documentation links, secret scan and diff checks; all clean.
- [x] Confirm `.gitignore` excludes local Shopify authentication/environment artefacts.
- [x] Confirm the exact current CLI syntax and candidate name.

## Unpublished upload record

The intended action is a new unpublished push only. Do not use a live-theme overwrite or force flag.

```powershell
npm.cmd exec shopify theme push -- --path . --store cfbexf-h4.myshopify.com --unpublished --theme "Docked Production Candidate 2026-08" --json --strict
```

Two Shopify platform validation errors were repaired during the initial creation sequence. Settings-data/schema sequencing was then reconciled, and this initial full push to the independently verified candidate ID returned cleanly:

```powershell
npm.cmd exec shopify theme push -- --path . --store cfbexf-h4.myshopify.com --theme 130871427130 --json --strict
```

| Field | Result |
| --- | --- |
| Upload attempted | Yes; new unpublished candidate plus clean full push |
| Initial clean full-push timestamp | Completed by 14 August 2026, 07:14 AEST |
| Historical exact-source strict-push window | `0b8d127b83d68930992643d666a7d26c1f1b067d`: 14 August 2026, 10:43:36–10:44:47 AEST |
| Initial brand-refresh strict push | `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818`: successful on 14 August 2026 AEST; exact CLI start/end timestamps not retained |
| Historical integrated-wordmark strict push | `5f46487d1f53e45f5706ae945eeb5a09064893e3`: successful on 14 August 2026 AEST before the historical detailed rendered brand QA; exact CLI start/end timestamps not retained |
| Interim one-product strict push | `5cc3edc`: 15 August 2026, 12:48:17–12:49:53 AEST; **failed**, because Shopify schema validation rejected `templates/index.json` `products_to_show` below the minimum of 2 |
| Corrected one-product strict push | `bb41a70d630041e95f627d05c62b7247b04257f7`: `2026-08-15T12:52:11.7607489+10:00`–`2026-08-15T12:53:12.6371436+10:00`; successful |
| Operator | Codex through owner-authenticated Shopify CLI session |
| CLI exit status | Success; no warning/error returned by the current strict JSON push |
| Returned store | `cfbexf-h4.myshopify.com` |
| Returned theme ID | `130871427130` |
| Returned role | `unpublished` |
| Returned preview URL | `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` |
| Returned editor URL | `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor` |
| Current exact uploaded commit | `bb41a70d630041e95f627d05c62b7247b04257f7` |
| Initial brand-refresh uploaded commit | `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` |
| Historical exact uploaded commit | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Current strict-push result | Corrected `bb41a70…` push completed successfully; interim `5cc3edc` attempt failed and is not an uploaded-source success |

Paste only a redacted CLI result or controlled evidence reference here. Do not paste tokens or authenticated URLs containing secrets.

## Admin content status

| Area | Current evidence |
| --- | --- |
| Store settings | Inspected; store contact email and address configured from supplied business facts |
| Australia/AUD/Melbourne/kilograms | Verified in Admin: backup region Australia, AUD, Canberra/Melbourne time zone, metric, kilograms |
| Legal entity/ABN/ACN | Owner-supplied repository facts; not verified in Admin |
| GST-inclusive configuration | Australia collects through Basic Tax and prices-include-sales-tax is checked; charge-sales-tax-on-shipping is unchecked. No order, invoice, discount, shipping-tax, cancellation or refund reconciliation has run |
| Customer accounts | New accounts are active. Signed-out candidate account entry opened Shopify's dialog with Sign in with Shop, email sign-in (submit disabled until email), marketing opt-in and Orders/Profile quick links. No credentials were entered; authentication, post-submit errors, logout and order history remain untested, so this is a partial entry-point pass only |
| Collections | All 7 planned collections created in Admin; empty because no SKU is approved or Active |
| Pages | All 12 planned Pages exist and all intended template suffixes were assigned and verified in Admin. Visible only behind password: Contact, How It Works, Safety and Care, FAQ, Track Your Order, Accessibility. Hidden pending applicable approvals: Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy, Terms of Service. The hidden custom Privacy Policy Page is distinct from Shopify's native policy resource; neither is approved |
| Menus | Authenticated Theme Editor lists the current one-product homepage composition, but current menu rendering was not tested. Historical `5f46487…` evidence: Main menu `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` rendered on desktop and at 320 px without overflow; Explore and support-menu observations remain historical only. Footer shopping menu ID `198327042106`, Footer support menu ID `198327074874` and unused Footer legal menu ID `198327107642` remain recorded Admin resources; unapproved Terms were withheld |
| Redirects | All 3 prepared redirects imported successfully. `/index.html` served homepage content; `/privacy.html` reached Shopify's privacy policy; `/about.html` correctly targets `/pages/about-docked` but remains 404 while About Docked is intentionally hidden pending the business-name gate |
| Products | On 15 August 2026, authenticated Admin showed 15 total shells. `Docked Cruise D2`, product ID `7591990034490`, remains the sole **Draft** shell with inventory not tracked, channels 0 and vendor `Requires verification`; the other 14 shells were changed to **Archived**, not deleted. None is approved or Active |
| Product media | No licensed exact-SKU documentary media is approved. None of the newly supplied AI-generated concept images was uploaded |
| Shipping | General profile contains unapproved Domestic Express `$15` / `1–2 business days`, Domestic Standard `$11` or free from `$100` / `3–5 business days`, and Standard international `$20` / `3–5 business days` for 27 countries. Carrier accounts: **None**; local pickup/delivery off; owner/carrier/package/battery/remote-area/checkout evidence absent |
| Payments | Shopify Payments requires more business information and shows **Complete setup**. PayPal displays **Active**, but its authorised account identity, currency, support details and test/refund behaviour are not verified. No test mode, test transaction or live-capture evidence exists |
| Policies | Shopify Policies shows only an **Automated** Privacy policy. Return and refund, Terms of service, Shipping policy and Legal notice show **No policy set**; Contact information is **Required** and no return/cancellation rule is set. Custom policy Pages remain hidden drafts and no policy is launch-approved |
| Support sender email | `support@docked.com.au` is configured, but Shopify Notifications reports **Email domain authentication — Needs setup** and says it may use a `shopifyemail.com` backup sender. Earlier Contact form acceptance is recorded; inbound, reply, Contact receipt, order/refund notification and delivered-header authentication evidence remain blocked |
| Store address | `GINTY UNITED INVESTMENTS PTY LTD, 135 Bamfield Road, Heidelberg Heights VIC 3081, Australia` configured; source documentation continues to qualify it as correspondence and authorised returns only |
| Markets | Australia is the only active market observed. An international shipping zone for 27 countries exists but Shopify states those countries must be added to a market before selling; international launch remains unapproved |
| Domains | Only the `cfbexf-h4.myshopify.com` primary domain is connected; no custom domain is connected |

Supplier files received on 15 August 2026 remain component-level review material. They do not establish the exact finished lounger, its two-battery retail configuration, Australian electrical/charger/RCM position, battery transport classification and carrier acceptance, load capacity, runtime/power/speed claims, exact-SKU media rights, final price, stock, shipping, policy approval, payments or test orders. Receipt therefore passes no launch gate. The accompanying AI-generated concept images were reviewed as references only and were not uploaded to Shopify.

## Preview and rendered-QA record

**Current revision boundary:** one-product commit `bb41a70d630041e95f627d05c62b7247b04257f7` is now strictly uploaded to candidate theme `130871427130`. Limited current evidence confirms the signed-out/direct preview remains password-protected, its password page displays **“Pool time, powered — soon.”** and D2 Draft wording, and the authenticated Theme Editor lists the one-product homepage composition. The inner homepage, product route and commerce/browser suite were not run against this commit. Detailed observations below apply to historical uploaded commit `5f46487d1f53e45f5706ae945eeb5a09064893e3` only and do not pass the current candidate.

The permanent preview URL exists and the storefront password was entered only in the authenticated in-app Browser. Manual responsive QA ran against the unpublished candidate at 320, 360, 375, 390, 768, 1024 and 1440 px. The initial real 320 px run exposed horizontal overflow; the mobile wordmark was constrained to `11rem`, theme `130871427130` was re-pushed, and the 320 px retest had no overflow.

Historical observed passes in the limited in-app-browser run were home, empty collection, empty cart, Contact, Safety and Care, FAQ and branded 404 routes; the mobile-menu mechanism in the earlier run; search, predictive search, cart drawer, desktop navigation and an eight-item FAQ accordion; and no broken images, console errors, Liquid errors, mixed content or old finance copy on the tested routes. Safety and Care and FAQ each rendered one H1 and no 404. Shopify accepted a controlled Contact form submission and displayed its success confirmation, but mailbox delivery was not verified. Checkout controls remained disabled. These observations do not cover the current one-product commit.

Historical exact source `0b8d127b83d68930992643d666a7d26c1f1b067d` was pushed strictly to theme `130871427130` from 10:43:36 to 10:44:47 AEST. Initial brand-refresh source `6d87c6c76ff20cb90e1a2af8735e9fd9c96d1818` and historical integrated one-word source `5f46487d1f53e45f5706ae945eeb5a09064893e3` were subsequently pushed successfully with `--strict` on 14 August 2026 AEST; exact CLI start/end timestamps were not retained. Shopify returned role `unpublished`, the verified store/name and the unchanged recorded preview/editor URLs. Existing live `Horizon`, ID `130871099450`, remained untouched.

After the historical `5f46487d1f53e45f5706ae945eeb5a09064893e3` push, the candidate was observed at all seven required widths with no viewport overflow. At 320 px, `innerWidth`, document `scrollWidth` and body `scrollWidth` were exactly `320/320/320`; the integrated header wordmark measured `110 × 25.71` px with viewBox `0 0 650 152`, hero art `288 × 345.6` px, its note `248 × 79.4` px and footer wordmark `220 × 51.44` px. Header wordmark widths across 320/360/375/390/768/1024/1440 were `110/157.575/163.963/180/180/180/180` px, and footer widths were `220/220/220/152/216/220/220` px; every viewport had document/body `scrollWidth` equal to `innerWidth`. At 1440 px, header/footer/hero widths were `180/220/552.14` px and desktop navigation remained intact. The 320 px mobile menu opened and rendered `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` without overflow. Header and footer links exposed `Docked — home`; the header mark used navy `#06283D` with cyan `#13BFE6`; the footer wordmark rendered white with cyan wake on scheme 3; and the hero included the navy mark, `18+` seal and complete preview-art accessible label. The password page rendered the hidden `Docked` name, theme favicon, H1 and modal on the initial brand push; the historical final source changed only wordmark SVG geometry. The favicon resolved from the theme asset, Organization JSON-LD contained an absolute `docked-mark.svg` asset URL, and the historical run's final console contained no errors or warnings. Screenshot/CDP capture timed out, so this historical run has DOM, geometry and computed-style observations but no new screenshot artifact.

Screenshots are retained in `docs/qa/production-preview/`. Full multi-browser, accessibility, Lighthouse, product, checkout, contact-delivery, customer-account and commerce QA remains required.

Rendered QA status: **One-product candidate uploaded; current password page and Theme Editor observed only; historical partial manual QA retained; full rendered-QA gate remains blocked**.

## Publication record

Publication is not authorised. Before any future publish, record:

| Field | Required value |
| --- | --- |
| Approved theme ID/name | Pending |
| Exact tested commit | Pending |
| Previous live theme ID/name | `130871099450` / `Horizon` |
| Rollback theme ID/name | Pending |
| Publication mode | Public prelaunch or full commercial launch |
| Exact authorisation phrase | Pending |
| Authorising account | Pending |
| Authorisation timestamp | Pending |
| Publication operator/timestamp | Pending |
| Store/domain | Pending |

Do not publish until [Production launch gates](PRODUCTION_LAUNCH_GATES.md) permits the intended mode. See [Production deployment](PRODUCTION_DEPLOYMENT.md) and [Production rollback](PRODUCTION_ROLLBACK.md).
