# Docked Shopify deployment record

Status: **UNPUBLISHED CANDIDATE UPLOADED — PARTIAL RENDERED QA COMPLETE; LAUNCH BLOCKED**
Last updated: 14 August 2026 (Australia/Sydney)

This record contains non-sensitive Shopify deployment metadata only. It must never contain credentials, Theme Access passwords, Admin tokens, bank information, identity documents, full payment data or customer data.

## Release candidate

| Field | Value / state |
| --- | --- |
| Repository | `bginty/docked` |
| Release branch | `release/docked-shopify-production-2026-08` |
| Starting commit | `895958891c8ec2780eba7ff224c5d0259d0de9dd` |
| Release-preparation/theme-source commit | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Draft pull request | [bginty/docked#1](https://github.com/bginty/docked/pull/1) |
| Theme root | Repository root |
| Candidate theme name | `Docked Production Candidate 2026-08` |
| Shopify CLI | 4.5.2 |
| Store handle | `cfbexf-h4.myshopify.com` — confirmed through authenticated Shopify CLI 4.5.2 |
| Shop domain | `cfbexf-h4.myshopify.com` |
| Store ID | Not available |
| Plan | Trial ending in 3 days; Admin showed **Subscribe for $1** / **Select a plan**; paid-plan gate blocked |
| Authenticated account | `Briant Ginty` (safe Admin display name); Shopify CLI session authenticated |
| Theme ID | `130871427130` |
| Theme role | `unpublished` |
| Permanent preview URL | `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` |
| Theme editor URL | `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor` |
| Previous/current live Shopify theme | `Horizon`, ID `130871099450`; preserved and unmodified |
| Published Docked theme | None evidenced |
| Storefront password | Enabled when observed: signed-out request redirected to `/password` and displayed **Docked — Opening soon** |

## Authenticated discovery record

The repository contains a valid Shopify Online Store 2.0 theme at its root. Shopify CLI 4.5.2 authenticated through Shopify's supported flow and confirmed `cfbexf-h4.myshopify.com`. Theme-library inspection identified the existing published `Horizon` theme, ID `130871099450`; it was preserved and not changed.

A signed-out browser request resolves to the Shopify password page and displays **Docked — Opening soon**. The storefront password was entered only in the authenticated in-app Browser, allowing candidate theme `130871427130` to be rendered for partial QA without removing password protection. This verifies store existence, password protection, candidate rendering and the CLI theme metadata; it does not verify paid-plan status, legal identity or launch readiness.

Authenticated Admin inspection confirmed AUD, Australia/Melbourne, metric units and kilograms. The supplied correspondence address and `support@docked.com.au` were configured; Shopify still reports the sender email as unverified. Australia is the only active market and new customer accounts are active. No plan selection, publication, product activation, payment-provider setup or custom-domain connection is recorded as completed.

## Pre-upload verification

- [x] Authenticate through Shopify's supported browser flow.
- [x] Confirm the current store is exactly `cfbexf-h4.myshopify.com` before the unpublished write.
- [ ] Confirm the store ID and legal business without copying sensitive fields; authenticated display name is `Briant Ginty`, but the store remains on a trial and a paid plan is not selected.
- [x] Record the current published Shopify theme name/ID and preserve it.
- [x] Use an unpublished creation flow and exact candidate ID; no publish, live overwrite or force flag was used.
- [x] Re-run Theme Check (186 files, 0 offenses).
- [x] Re-run structural validation (57/57), production gate validation (21/21 required; 23 total) and Node tests (5/5).
- [x] Re-run copy/data audits, dependency audit, documentation links and secret scan.
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
| Exact release-commit strict-push window | 14 August 2026, 10:43:36–10:44:47 AEST |
| Operator | Codex through owner-authenticated Shopify CLI session |
| CLI exit status | Success; no warning/error returned by the final strict JSON push |
| Returned store | `cfbexf-h4.myshopify.com` |
| Returned theme ID | `130871427130` |
| Returned role | `unpublished` |
| Returned preview URL | `https://cfbexf-h4.myshopify.com?preview_theme_id=130871427130` |
| Returned editor URL | `https://cfbexf-h4.myshopify.com/admin/themes/130871427130/editor` |
| Exact uploaded commit | `0b8d127b83d68930992643d666a7d26c1f1b067d` |
| Asset rejection/missing-file result | Final full strict push completed cleanly; no warning/error returned |

Paste only a redacted CLI result or controlled evidence reference here. Do not paste tokens or authenticated URLs containing secrets.

## Admin content status

| Area | Current evidence |
| --- | --- |
| Store settings | Inspected; store contact email and address configured from supplied business facts |
| Australia/AUD/Melbourne/kilograms | Verified in Admin: backup region Australia, AUD, Canberra/Melbourne time zone, metric, kilograms |
| Legal entity/ABN/ACN | Owner-supplied repository facts; not verified in Admin |
| GST-inclusive configuration | Admin shows GST collection enabled for Australia with the owner-supplied ABN and the prices-include-sales-tax setting checked; no order, invoice, discount, shipping-tax, cancellation or refund reconciliation has run |
| Customer accounts | New accounts are active. Signed-out candidate account entry opened Shopify's dialog with Sign in with Shop, email sign-in (submit disabled until email), marketing opt-in and Orders/Profile quick links. No credentials were entered; authentication, post-submit errors, logout and order history remain untested, so this is a partial entry-point pass only |
| Collections | All 7 planned collections created in Admin; empty because no SKU is approved or Active |
| Pages | All 12 planned Pages exist and all intended template suffixes were assigned and verified in Admin. Visible only behind password: Contact, How It Works, Safety and Care, FAQ, Track Your Order, Accessibility. Hidden pending applicable approvals: Shipping and Delivery, Returns and Refunds, Warranty, About Docked, Privacy Policy, Terms of Service. The hidden custom Privacy Policy Page is distinct from Shopify's native policy resource; neither is approved |
| Menus | Main menu `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ` rendered on desktop and in the opened 390 px mobile menu after the exact-commit push. Candidate Explore rendered `Powered Pool Floats`, `Adult Pool Loungers`, `Adult Pool Games`, `Floating Bars and Coolers`, `Pumps, Care and Repair`, `Pool Party Bundles`, `Shop All`. Help and policies rendered `Search`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`, `Track Your Order`, `Accessibility`. Shopify's native Privacy policy link rendered separately through `show_policy`. Footer shopping menu ID `198327042106` and Footer support menu ID `198327074874` supply the two mapped blocks. Footer legal menu ID `198327107642` remains an unused Admin resource and did not render; unapproved Terms were withheld |
| Redirects | All 3 prepared redirects imported successfully. `/index.html` served homepage content; `/privacy.html` reached Shopify's privacy policy; `/about.html` correctly targets `/pages/about-docked` but remains 404 while About Docked is intentionally hidden pending the business-name gate |
| Products | 15 concepts imported and verified **Draft**; inventory not tracked, no images, channels 0, vendor `Requires verification`, no approved SKU claims; none approved/Active |
| Product media | No licensed exact-SKU product media supplied |
| Shipping | Unapproved Express $15, Standard $11/free-over-$100 and Standard international $20 rates removed; international zone deleted; Domestic Australia remains with **no rates**; local pickup/delivery off; checkout shipping tests not run |
| Payments | Shopify Payments stops at required business-information setup; no provider active, no test mode, no test transaction and no live capture |
| Policies | The custom Privacy Policy and Terms of Service Pages remain hidden drafts. Shopify's separate native `/policies/privacy-policy` resource is reachable only behind the storefront password and is used by the existing redirect/menu resource; it is also unapproved. No policy is recorded as launch-approved or publicly published. |
| Support sender email | `support@docked.com.au` configured. After the owner's mailbox-setup report, Admin Notifications was rechecked: the sender textbox still contained that address, status remained **Unverified**, and **Resend verification** was offered. A controlled Contact form submission was accepted at `?contact_posted=true` with Shopify's success confirmation, but mailbox delivery remains unverified. An attempted external Gmail send could not be performed because the connected account's Mail service was not enabled; inbound/reply/order/refund notification evidence remains blocked |
| Store address | `GINTY UNITED INVESTMENTS PTY LTD, 135 Bamfield Road, Heidelberg Heights VIC 3081, Australia` configured; source documentation continues to qualify it as correspondence and authorised returns only |
| Markets | Australia is the only active market observed; US and EU appear only as create-market prompts, not active markets; the international shipping zone was deleted |
| Domains | Only the `cfbexf-h4.myshopify.com` primary domain is connected; no custom domain is connected |

## Preview and rendered-QA record

The permanent preview URL exists and the storefront password was entered only in the authenticated in-app Browser. Manual responsive QA ran against the unpublished candidate at 320, 360, 375, 390, 768, 1024 and 1440 px. The initial real 320 px run exposed horizontal overflow; the mobile wordmark was constrained to `11rem`, theme `130871427130` was re-pushed, and the 320 px retest had no overflow.

Observed passes in the limited in-app-browser run were home, empty collection, empty cart, Contact, Safety and Care, FAQ and branded 404 routes; the mobile-menu mechanism in the earlier run; search, predictive search, cart drawer, desktop navigation and an eight-item FAQ accordion; and no broken images, console errors, Liquid errors, mixed content or old finance copy on the tested routes. Safety and Care and FAQ each rendered one H1 and no 404. Shopify accepted a controlled Contact form submission and displayed its success confirmation, but mailbox delivery was not verified. Checkout controls remained disabled. No public product route was available because every product remains Draft.

Exact release commit `0b8d127b83d68930992643d666a7d26c1f1b067d` was pushed strictly to theme `130871427130` from 10:43:36 to 10:44:47 AEST; Shopify returned role `unpublished`, the verified store/name and the recorded preview/editor URLs. The post-push candidate measured `innerWidth=390` and `scrollWidth=390`. Its mobile menu opened and rendered `Home`, `Shop`, `Contact`, `How It Works`, `Safety and Care`, `FAQ`. Footer Explore rendered the seven planned collection links, Help and policies rendered the seven support links, and Shopify's native Privacy policy link rendered separately through `show_policy`. Footer legal menu ID `198327107642` remains an unused Admin resource and was not rendered.

Screenshots are retained in `docs/qa/production-preview/`. Full multi-browser, accessibility, Lighthouse, product, checkout, contact-delivery, customer-account and commerce QA remains required.

Rendered QA status: **Partial manual in-app-browser QA completed; full rendered-QA gate remains blocked**.

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
