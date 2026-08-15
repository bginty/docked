# Docked static PayPal deployment record

Status: live on `docked.com.au`; PayPal checkout enabled; HTTP-to-HTTPS enforcement pending

Last updated: 15 August 2026 (AEST)

## Deployment scope

- Repository: `https://github.com/bginty/docked.git`
- Working branch: `codex/docked-static-paypal-launch`
- Production source: `main` branch, repository root, through GitHub's platform-managed `pages-build-deployment` workflow
- Starting production commit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Canonical domain: `https://docked.com.au`
- `CNAME`: `docked.com.au`
- DNS and email DNS: unchanged by this release

The public production commit contains only the 28-file static web output. Development tests, source-image custody files, processing scripts, evidence records, screenshots and Shopify history remain on the working branch and in Git history; they are not copied into the Pages root.

## Preserved systems

- Finance-site archive branch: `archive/docked-finance-site-2026-08`
- Finance-site archive tag: `docked-finance-site-before-pool-rebuild`
- Both recovery refs peel to `b26add982e5f4c7cfab2b13f74a14500d7199530`.
- The existing Shopify store, unpublished theme and Shopify branches remain recoverable but are not part of production.

## PayPal integration

The owner supplied the official PayPal Hosted Buttons embed with public client-side identifier and hosted-button ID `FGAUDYCA2LX36`. No PayPal password, client secret, banking detail, API credential or private key was supplied or stored.

The hosted button was tested without entering payment details or completing a transaction:

- product: `Docked Cruise D2`;
- website and PayPal amount: `A$649.00 AUD`;
- quantity selector: 1 to 10;
- checkout total at quantity 1: `$649.00 AUD`;
- payment surface offered PayPal, Pay in 4, Apple Pay and debit/credit card, subject to PayPal and buyer eligibility;
- card flow requested billing/delivery address fields and supported countries worldwide;
- owner instruction received on 15 August 2026: free shipping and worldwide delivery;
- site disclosure: free worldwide standard shipping, subject to carrier service and local restrictions;
- real payment: not run and not authorised.

The public identifier in the SDK URL and the hosted-button ID are intentionally published client-side PayPal configuration. They are not merchant secrets.

### Rejected developer sample

`standard_html_javascript.zip` (SHA-256 `045C2311B7229156134CBB23470AEF7E0559B5734DCF9D9428C93F48F557FF87`) was inspected read-only and not copied into the repository. It was a generic USD/US sandbox-oriented Node sample requiring server credentials, not a production payment link or hosted button.

## Evidence ledger

| Item | Result | Evidence |
| --- | --- | --- |
| Repository identity | Passed | `origin` is `https://github.com/bginty/docked.git`; branch was created from exact `origin/main`. |
| Pages source | Passed | Existing platform workflow `pages-build-deployment` (workflow ID `286250434`) serves `main` at repository root. |
| Backup refs | Passed | Archive branch and peeled annotated tag both resolve to the exact legacy commit. |
| Static validation | Passed locally | `npm run validate`: 28/28 passed, including hosted-button, shipping, product-media integrity, links, claims and secret gates. |
| Node tests | Passed locally | `npm test`: 5/5 passed. |
| Local browser QA | Passed with stated limits | See `docs/qa/static-preview/README.md`. |
| Supplier product imagery | Passed for publication | Owner confirmed the supplied images depict the Docked product and approved their use. Fixed, non-generative crops remove unsupported promotional overlays; derivative hashes and source custody are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`. |
| PayPal product/price/currency | Passed | Fresh hosted checkout showed Docked Cruise D2, A$649.00 and AUD. |
| PayPal delivery capture | Passed | Card flow requested a delivery address and exposed worldwide countries; no data was entered. |
| Shipping offer | Owner approved | Free worldwide shipping, subject to carrier service and local restrictions. |
| Real payment | Not run | No real payment was authorised or completed. |
| Working-branch push | Passed | Product-led revision `f3475f2d60aa7ce011b726cf6a4d6050c8baee39` is pushed to `origin/codex/docked-static-paypal-launch`. |
| Production promotion | Passed | `main` was fast-forwarded without force to `5aceddc9726d7d2617c8e2e09c1b4f290f87e633`; Pages [run #98](https://github.com/bginty/docked/actions/runs/31874058651) completed successfully. |
| Public rendered verification | Passed with stated limits | The live page rendered the new product-led hero, supplier imagery, A$649 offer, free-shipping copy, gallery controls and PayPal Hosted Button. No first-party Docked console error was observed; PayPal emitted its own Pay Later/Apple Pay eligibility diagnostics. |
| Public HTTPS verification | HTTPS live; enforcement pending | Valid HTTPS returned the current storefront; `www` redirected to the HTTPS apex. Plain `http://docked.com.au/` still returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`. |

## Final deployment record

- Static-site working commit: `f3475f2d60aa7ce011b726cf6a4d6050c8baee39`
- Production commit: `5aceddc9726d7d2617c8e2e09c1b4f290f87e633`
- GitHub Pages deployment: workflow `pages build and deployment`, run `98`, run ID `31874058651`, deployment ID `5918633369`, completed successfully at `2026-08-15T08:16:35Z`
- Production tag: `docked-static-paypal-launch-2026-08` remains the immutable initial-launch tag (annotated tag object `c9510d884b79248d98f837047d10cc7fd9762c3d`, peeled commit `a4d9075e13a90a03a8587b5641626f0d42a36160`); it was not moved for this product-media revision.
- Live verification window: `2026-08-15 18:18–18:20 AEST`
- Logged-out production URL: `https://docked.com.au`

The live audit confirmed the product-led homepage, supplier-image derivatives, gallery interaction, all public pages, the custom 404 and the production PayPal Hosted Button. The current page had no horizontal overflow in the inspected desktop viewport and contained one understated `18+` mention beside ordering. Checked retired finance routes returned the branded 404. A real payment, seller-side transaction record, payment email, refund and PayPal return URL remain deliberately untested.
