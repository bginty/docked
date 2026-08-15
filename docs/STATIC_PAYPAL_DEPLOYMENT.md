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

The public production commit contains only the 31-file static web output. Development tests, source-image custody files, processing scripts, evidence records, screenshots and Shopify history remain on the working branch and in Git history; they are not copied into the Pages root.

## Current feature-board revision

The current working-tree revision adds the supplier feature board at `assets/images/product/cruise-d2-features.jpg`. Its owner-supplied source is `C:\Users\61412\Desktop\1000047443.png`: 405,229 bytes, 1536 × 1536 pixels, SHA-256 `93E1A9A811B851185F1B9335850A99561B8B54994A2FD46AA147F0E912A7054C`. Although the source filename ends in `.png`, its payload is JPEG/JFIF. The 507,583-byte public derivative is also 1536 × 1536 JPEG/JFIF and has SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`.

The owner confirmed that the image came from the supplier, depicts the Docked product and is authorised for website use. The owner separately confirmed the six displayed product facts: motorised electric propulsion, up to 5 km/h, dual joystick control, 160 kg capacity, built-in cup holder and supportive headrest. The derivative preserves the supplier product and those confirmed callouts, but deterministically replaces the source's unsupported “strong and stable” / “safe and comfortable ride” sentence with the neutral text “Maximum supported load: 160 kg.” No independent speed/performance or 160 kg load-bearing test has been reviewed, and the site does not describe either value as independently verified.

The rebuild centralises PayPal configuration, adds Contact and Warranty pages, exposes only confirmed specifications, strengthens the buyer journey and makes the supplied feature board a prominent uncropped homepage visual. Local validation passed 37/37, Node tests passed 8/8, and rendered QA passed at 360, 390, 430, 768, 1024 and 1440 CSS pixels with no page-wide overflow. PayPal rendered the configured Cruise D2 at A$649.00 AUD; no payment was attempted.

The reviewed public source is commit `06d4bd1941517b79c10a72a59d581969afd58f31`. Its 31-file public allowlist was committed separately as production commit `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`, fast-forwarded to `main` without force and deployed successfully by Pages run #99.

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
| Static validation | Passed locally | `npm run validate`: 37/37 passed, including hosted-button, shipping, product-media integrity/hash, links, claims, schema and secret gates. |
| Node tests | Passed locally | `npm test`: 8/8 passed. |
| Local browser QA | Passed with stated limits | See `docs/qa/static-preview/README.md`. |
| Supplier product imagery | Passed for publication | Owner confirmed the supplied images depict the Docked product and approved their use. Fixed, non-generative crops remove unsupported promotional overlays; derivative hashes and source custody are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`. |
| PayPal product/price/currency | Passed | Fresh hosted checkout showed Docked Cruise D2, A$649.00 and AUD. |
| PayPal delivery capture | Passed | Card flow requested a delivery address and exposed worldwide countries; no data was entered. |
| Shipping offer | Owner approved | Free worldwide shipping, subject to carrier service and local restrictions. |
| Real payment | Not run | No real payment was authorised or completed. |
| Working-branch push | Passed | Feature-board source revision `06d4bd1941517b79c10a72a59d581969afd58f31` is pushed to `origin/codex/docked-static-paypal-launch`. |
| Production promotion | Passed | `main` was fast-forwarded without force to `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`; Pages [run #99](https://github.com/bginty/docked/actions/runs/31880122836) completed successfully. |
| Public rendered verification | Passed with stated limits | The live page rendered the revised hero, text-redacted supplier feature board, six confirmed specifications, A$649 offer, free-shipping copy and PayPal Hosted Button. Live Contact and Warranty pages returned 200. No first-party Docked console error was observed in candidate QA; PayPal emitted its own Pay Later eligibility diagnostic. |
| Public HTTPS verification | HTTPS live; enforcement pending | Valid HTTPS returned the current storefront; `www` redirected to the HTTPS apex. Plain `http://docked.com.au/` still returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`. |

## Final deployment record

- Static-site working commit: `06d4bd1941517b79c10a72a59d581969afd58f31`
- Production commit: `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`
- GitHub Pages deployment: workflow `pages build and deployment`, run `99`, run ID `31880122836`, deployment ID `5919624892`, completed successfully at `2026-08-15T10:41:09Z`
- Production tag: `docked-static-paypal-launch-2026-08` remains the immutable initial-launch tag (annotated tag object `c9510d884b79248d98f837047d10cc7fd9762c3d`, peeled commit `a4d9075e13a90a03a8587b5641626f0d42a36160`); it was not moved for this product-media revision.
- Live verification window: `2026-08-15 20:42–20:44 AEST`
- Logged-out production URL: `https://docked.com.au`

The live audit confirmed the revised product-led homepage, exact registered feature-board hash, supplier-image derivatives, all nine public pages, the custom 404 and the production PayPal Hosted Button. At 390 and 1440 CSS pixels, document `scrollWidth` equalled `clientWidth`; the desktop price and primary purchase action were above the fold. The live page contained one understated `18+` mention beside ordering and no checked finance copy. A real payment, seller-side transaction record, payment email, refund and PayPal return URL remain deliberately untested.
