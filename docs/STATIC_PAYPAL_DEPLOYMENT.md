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

The public production commit contains only the static web output. Development tests, scripts, evidence records, screenshots and Shopify history remain on the working branch and in Git history; they are not copied into the Pages root.

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
| Static validation | Passed locally | `npm run validate`: 26/26 passed, including hosted-button, shipping, links, claims and secret gates. |
| Node tests | Passed locally | `npm test`: 5/5 passed. |
| Local browser QA | Passed with stated limits | See `docs/qa/static-preview/README.md`. |
| PayPal product/price/currency | Passed | Fresh hosted checkout showed Docked Cruise D2, A$649.00 and AUD. |
| PayPal delivery capture | Passed | Card flow requested a delivery address and exposed worldwide countries; no data was entered. |
| Shipping offer | Owner approved | Free worldwide shipping, subject to carrier service and local restrictions. |
| Real payment | Not run | No real payment was authorised or completed. |
| Working-branch push | Passed | Commit `be44b0d34be1987b3bdc13bd2ce864b02182b55e` is pushed to `origin/codex/docked-static-paypal-launch`. |
| Production promotion | Passed | `main` was fast-forwarded without force to `a4d9075e13a90a03a8587b5641626f0d42a36160`; Pages [run #97](https://github.com/bginty/docked/actions/runs/31872052450) completed successfully. |
| Public HTTPS verification | HTTPS live; enforcement pending | Valid HTTPS returned the current storefront; `www` redirected to the HTTPS apex. Plain `http://docked.com.au/` still returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`. |

## Final deployment record

- Static-site working commit: `be44b0d34be1987b3bdc13bd2ce864b02182b55e`
- Production commit: `a4d9075e13a90a03a8587b5641626f0d42a36160`
- GitHub Pages deployment: workflow `pages build and deployment`, run `97`, run ID `31872052450`, deployment ID `5918312600`, completed successfully at `2026-08-15T07:29:19Z`
- Production tag: `docked-static-paypal-launch-2026-08` (annotated tag object `c9510d884b79248d98f837047d10cc7fd9762c3d`, peeled commit `a4d9075e13a90a03a8587b5641626f0d42a36160`)
- Live verification time: `2026-08-15 17:36:28 AEST`
- Logged-out production URL: `https://docked.com.au`

The live audit confirmed the current homepage, all public pages and assets, the custom 404, canonical metadata, robots and sitemap, and the production PayPal Hosted Button. All checked legacy finance-only routes returned the branded 404. A real payment, seller-side transaction record, payment email, refund and PayPal return URL remain deliberately untested.
