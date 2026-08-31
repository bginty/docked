# Docked static PayPal deployment record

Status: `$299` price revision is live on `docked.com.au`; website and PayPal amounts match; exact four-file production commit deployed successfully; HTTP-to-HTTPS enforcement remains pending

Last updated: 31 August 2026 (AEST)

## Deployment scope

- Repository: `https://github.com/bginty/docked.git`
- Working branch: `codex/docked-static-paypal-launch`
- Production source: `main` branch, repository root, through GitHub's platform-managed `pages-build-deployment` workflow
- Starting production commit: `b26add982e5f4c7cfab2b13f74a14500d7199530`
- Canonical domain: `https://docked.com.au`
- `CNAME`: `docked.com.au`
- DNS and email DNS: unchanged by this release

The public production commit contains only the 31-file static web output. Development tests, source-image custody files, processing scripts, evidence records, screenshots and Shopify history remain on the working branch and in Git history; they are not copied into the Pages root.

## $299 price revision — deployed and live-verified

The owner stated that the PayPal product price had been changed to `$299` and explicitly instructed that the website price be updated. Before the website change, logged-out rendered inspection confirmed that the PayPal Hosted Button already displayed `Docked Cruise D2` at `$299.00 AUD` while Docked's own page still displayed `$649`. The website revision therefore aligned every current customer-facing offer surface with the authoritative hosted-button amount.

The reviewed source implementation is commit `f454fde58805c5d6b8b46b2e953398601fb91386` on `codex/docked-static-paypal-launch`. Its exact four-file public payload is production commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8`, pushed to `codex/docked-static-pages-production` and fast-forwarded to `main` without force. The previous production commit is `5be6e075d6d72bf6ebc8c96b131b7fa257465868`.

The exact price-release allowlist is:

- `assets/js/product-config.js`
- `index.html`
- `shipping-returns.html`
- `terms.html`

The product configuration is the runtime source of truth for rendered price targets and Product/Offer JSON-LD. Static homepage fallbacks, purchase actions, metadata, the Shipping & Returns page, and the Terms page now all use `$299 AUD`. The validator and tests reject the stale `$649` price in customer-facing files.

Local verification passed before promotion: `npm run validate` passed 51/51 checks, `npm test` passed 15/15, the four JavaScript syntax checks passed, and `git diff --check` passed. Local Browser QA at 320, 390, and 1440 CSS pixels showed `$299` on the website, `$299.00 AUD` in PayPal, no stale `$649`, no horizontal overflow, and no broken image.

GitHub Pages [run #102](https://github.com/bginty/docked/actions/runs/33383154217), run ID `33383154217`, completed successfully for exact production commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8` at 20:36:34 AEST on 31 August 2026. Build, report-build-status, and deploy jobs all passed; deploy job ID `99459811102` completed successfully.

Logged-out live QA repeated the 320, 390, and 1440 CSS-pixel matrix. At every width, the Docked offer displayed `$299` with `AUD · Free shipping`, PayPal displayed `Docked Cruise D2` at `$299.00 AUD`, no visible `$649` remained, document `scrollWidth` equalled `clientWidth`, and no broken image was detected. The Shipping & Returns and Terms pages both displayed `$299 AUD` and no `$649 AUD`. Live Product/Offer JSON-LD contained price `299` and currency `AUD`. All four changed public files matched the reviewed production files after expected CRLF-to-LF normalization.

No buyer data was entered, the checkout control was not activated, and no payment was submitted. PayPal emitted its third-party `ncps_standalone_paylater_ineligible` diagnostic; no first-party Docked error was observed. The HTTPS apex returned `200` and `www` returned `301` to it. Plain HTTP still returned `200` without redirecting and no HSTS header was present, so HTTPS enforcement remains pending. Evidence and the live 390-pixel screenshot are in `docs/qa/static-preview/price-299/`.

## Historical summer-feedback revision — authorized, deployed and live-verified

The owner approved implementing the unambiguous visual and merchandising changes supplied in `Website Ideas.eml`, while retaining the existing Docked logo and `Cruise D2` product name. The reviewed source implementation is commit `be6d391743feec1ef869694b9ad67d42f02497d0`, pushed to `origin/codex/docked-static-paypal-launch`; later evidence-only source HEAD at the time of deployment was `54d9a21`. Its exact eight-file public payload is production commit `5be6e075d6d72bf6ebc8c96b131b7fa257465868`, pushed to `origin/codex/docked-static-pages-production` and then fast-forwarded to `main` without force after the owner entered `AUTHORISE_PUBLISH_SUMMER_REVISION_5BE6E07` in the active session.

The deployed revision:

- brightens the established palette with sunshine yellow, pool cyan, coral and navy accents;
- removes the small hero product eyebrow while keeping the approved feature-board-first sales sequence and `$649 AUD · Free shipping` offer;
- uses fixed, deterministic crops of the approved `Man on Float.png` and `Girl on Float.png` email attachments in the “More than a float” and “Control from your seat” panels;
- removes the redundant lifestyle-image caption and simplifies the specifications introduction;
- restores a three-panel product slideshow with explicit tab/tabpanel relationships and keyboard navigation; and
- makes the real `#checkout` purchase action contextually persistent when checkout is enabled: it appears only when the hero, checkout and final purchase action are outside the viewport.

The feature-board and both lifestyle sources contain C2PA provenance identifying `gpt-image v2.0` and the digital-source type `trainedAlgorithmicMedia`. The site therefore presents the feature board as a visible “Supplier product illustration” and each lifestyle image as a visible “Supplier lifestyle illustration”; their alt text also identifies them as illustrations. Cropping, resizing, redaction and encoding are deterministic, but the underlying sources are AI-credentialed and are not represented as documentary product photographs.

The deployed feature board preserves the supplied depiction, layout and approved callouts. A deterministic water-texture patch removes only the sentence “Strong and stable design for a safe and comfortable ride.” and adds no replacement box or claim. The owner's publication approval is recorded, but no independent speed/performance test or 160 kg load-bearing test was supplied or reviewed. Owner approval is not recorded as technical substantiation for that qualitative safety/comfort statement. Full C2PA provenance, source custody, crop coordinates, processing details and byte hashes are in `docs/STATIC_SITE_ASSET_REGISTER.md`.

The deployed public payload is limited to these eight paths:

- `assets/css/styles.css`
- `assets/images/product/cruise-d2-features.jpg`
- `assets/images/product/cruise-d2-lifestyle-man-1200.webp`
- `assets/images/product/cruise-d2-lifestyle-man-600.webp`
- `assets/images/product/cruise-d2-lifestyle-woman-1200.webp`
- `assets/images/product/cruise-d2-lifestyle-woman-600.webp`
- `assets/js/site.js`
- `index.html`

The processing script, asset register, validator, tests and QA records are working-branch evidence rather than public Pages payload. The configured PayPal public client ID, hosted-button ID `FGAUDYCA2LX36`, product identity, price, currency and shipping copy are unchanged.

Local automated evidence recorded on 16 August 2026:

- `npm run validate`: 51/51 passed;
- `npm test`: 15/15 passed;
- `node --check` passed for `assets/js/site.js`, `assets/js/product-config.js`, `scripts/validate-static-site.mjs` and `tests/static-site.test.mjs`; and
- `git diff --check`: passed.

Fresh local rendered QA passed at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. Every viewport had no page-wide overflow or broken image, displayed all three supplier-illustration disclosures, retained the man illustration's 1.5 aspect ratio with computed `min-height: 0px`, and showed the persistent purchase bar only when no alternate purchase surface was visible. The bar remained hidden while the hero action, checkout or final action was visible.

At 390 CSS pixels, gallery click and `ArrowRight` navigation reached the `Poolside` panel, the mobile menu opened and closed with `Escape`, and PayPal rendered two iframes with `Docked Cruise D2` at `$649.00 AUD`. Activating the persistent CTA reached `#checkout` with the checkout heading at approximately 112 CSS pixels from the viewport top; the bar was hidden there. No first-party Docked console error was observed. PayPal emitted its third-party `ncps_standalone_paylater_ineligible` diagnostic and Apple Pay configuration messages. Six screenshots are recorded in `docs/qa/static-preview/summer-feedback/`.

After the exact authorization phrase was received, production commit `5be6e075d6d72bf6ebc8c96b131b7fa257465868` was fast-forwarded to `main` without force. GitHub Pages [run #101](https://github.com/bginty/docked/actions/runs/31915757230), run ID `31915757230`, completed successfully at 09:51:00 AEST on 16 August 2026. Deployment ID `5925876775`, status ID `16863925709`, reached `success` at 09:50:59 AEST. Live-domain QA then ran through approximately 10:05 AEST. All eight public paths returned `200` and matched the deployed files byte-for-byte or after the expected text normalization; all 24 local references across seven public pages returned `200`, and no finance-site copy was found.

Fresh live rendered QA passed at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. At every width there was no horizontal overflow or visible broken image; all three supplier-illustration disclosures were visible; the man illustration retained its 1.5 aspect ratio and `min-height: 0px`; `$649` and two PayPal iframes rendered; and the contextual purchase bar was hidden at the hero, checkout and final action while visible mid-page. At 390 pixels, gallery keyboard navigation reached `Poolside`, the menu opened and closed with `Escape`, the persistent CTA reached `#checkout` with its heading approximately 112 pixels from the viewport top, and PayPal displayed `Docked Cruise D2` at `$649.00 AUD`. No payment or buyer-data entry occurred. No first-party console error was observed; the only recorded live console diagnostic was PayPal's third-party `ncps_standalone_paylater_ineligible`. No Lighthouse or automated accessibility result is claimed. The detailed QA register and live screenshots are in `docs/qa/static-preview/summer-feedback/`.

## Screenshot-reference production revision

The deployed revision follows the owner-approved mobile reference while retaining the verified Cruise D2 product asset and PayPal Hosted Button. The complete feature board is the first major visual beneath the header. The product label, headline, supporting copy, `$649 AUD` offer, primary purchase action, secondary feature action and concise feature line follow it in the approved order.

Customer-facing copy uses `Free shipping` without a geographic qualifier. The superseded `A$` notation is absent: visible website price targets use `$649`, with `AUD` alongside them. Ginty United Investments Pty Ltd, ABN 78 606 187 106 and `support@docked.com.au` are consolidated in the homepage's bottom footer rather than appearing inside the sales content.

Local and live Browser QA covered 320, 360, 390, 430, 768, 1024 and 1440 CSS-pixel viewports. At every live size, document `scrollWidth` equalled `clientWidth`, the complete feature image remained contained and the secondary hero action remained visible. Screenshots are recorded in `docs/qa/static-preview/reference-layout/`. PayPal rendered `Docked Cruise D2` at `$649.00 AUD`; the purchase action resolved to `#checkout`. `npm run validate` passed 41/41 checks and `npm test` passed 10/10 tests before deployment. No buyer data was entered and no payment was submitted.

The reviewed source implementation commit `777b09037e0f78e627cef09e710b05f0c4d88ff6` was pushed to `origin/codex/docked-static-paypal-launch`. Its exact eight changed public files were promoted as production commit `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde` and fast-forwarded to `main` without force. Post-deployment evidence documentation and live screenshots were created after the reviewed implementation commit and are intentionally separate from that exact public payload. No new Lighthouse, automated accessibility or console-clean result is claimed.

The eight production changes are `assets/css/styles.css`, `assets/js/product-config.js`, `assets/js/site.js`, `index.html`, `privacy.html`, `safety.html`, `shipping-returns.html` and `terms.html`.

GitHub Pages [run #100](https://github.com/bginty/docked/actions/runs/31883818055), run ID `31883818055`, was created at `2026-08-15T12:07:55Z` and completed successfully at `2026-08-15T12:08:17Z`. Deployment ID `5920263065`, status ID `16849484631`, was created at `2026-08-15T12:08:05Z` and completed with `success` at `2026-08-15T12:08:17Z`.

## Preceding feature-board revision

The preceding deployed revision added the supplier feature board at `assets/images/product/cruise-d2-features.jpg`. Its owner-supplied source is `C:\Users\61412\Desktop\1000047443.png`: 405,229 bytes, 1536 × 1536 pixels, SHA-256 `93E1A9A811B851185F1B9335850A99561B8B54994A2FD46AA147F0E912A7054C`. Although the source filename ends in `.png`, its payload is JPEG/JFIF. The 507,583-byte public derivative is also 1536 × 1536 JPEG/JFIF and has SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`.

The owner confirmed that the image came from the supplier, depicts the Docked product and is authorised for website use. The owner separately confirmed the six displayed product facts: motorised electric propulsion, up to 5 km/h, dual joystick control, 160 kg capacity, built-in cup holder and supportive headrest. The derivative preserves the supplier product and those confirmed callouts, but deterministically replaces the source's unsupported “strong and stable” / “safe and comfortable ride” sentence with the neutral text “Maximum supported load: 160 kg.” No independent speed/performance or 160 kg load-bearing test has been reviewed, and the site does not describe either value as independently verified.

That deployed rebuild centralised PayPal configuration, added Contact and Warranty pages, exposed only confirmed specifications, strengthened the buyer journey and made the supplied feature board a prominent uncropped homepage visual. Its local validation passed 37/37, Node tests passed 8/8, and rendered QA passed at 360, 390, 430, 768, 1024 and 1440 CSS pixels with no page-wide overflow. PayPal rendered the configured Cruise D2 at `$649.00 AUD`; no payment was attempted.

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
- live website amount: `$299 AUD`;
- PayPal quantity-one total: `$299.00 AUD`;
- quantity selector: 1 to 10;
- payment surface offered PayPal, Pay in 4, Apple Pay and debit/credit card, subject to PayPal and buyer eligibility;
- live site disclosure: `Free shipping`, with no geographic qualifier;
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
| Static validation | Passed locally | Current `$299` production revision: `npm run validate` passed 51/51, including the stale-price and secret gates. |
| Node tests | Passed locally | Current `$299` production revision: `npm test` passed 15/15. |
| Local browser QA | Passed with stated limits | See `docs/qa/static-preview/README.md`. |
| Summer-feedback experience | Passed locally and live | Bright summer palette, feature-board-first hierarchy, lifestyle illustrations, three-panel gallery and contextual purchase action rendered on the exact production commit. |
| Responsive live matrix | Passed | Current price-release QA passed at 320, 390, and 1440 CSS pixels with no horizontal overflow, broken image, or stale price; the earlier seven-width layout evidence remains preserved. |
| Seller-detail placement | Passed live | Company name, ABN and support email are outside homepage sales content and grouped in the bottom footer. |
| Supplier product imagery | Passed for the deployed revision | Owner confirmed the supplied imagery and approved its use. The feature-board and lifestyle sources are C2PA `gpt-image v2.0` / `trainedAlgorithmicMedia`; their deterministic public derivatives are visibly labelled supplier illustrations. Hashes, processing and source custody are in `docs/STATIC_SITE_ASSET_REGISTER.md`. |
| PayPal product/price/currency | Passed locally and live | The hosted widget showed Docked Cruise D2 and `$299.00 AUD`; no payment was submitted. |
| Shipping offer copy | Passed live | Customer-facing copy says `Free shipping` with no geographic qualifier; no `worldwide` copy was visible. |
| Real payment | Not run | No real payment was authorised or completed. |
| Working-branch implementation push | Passed | Reviewed price implementation commit `f454fde58805c5d6b8b46b2e953398601fb91386` is pushed to `origin/codex/docked-static-paypal-launch`. |
| Owner production instruction | Passed | In the active session, the owner stated that PayPal had been changed to `$299` and instructed that the website price be updated. |
| Production promotion | Passed | Exact four-file commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8` was fast-forwarded to `main` without force; Pages [run #102](https://github.com/bginty/docked/actions/runs/33383154217) completed successfully. |
| Public file and link audit | Passed for price-release scope | All four changed public paths matched locally after expected text normalization; both affected policy pages rendered the current amount. |
| Public rendered verification | Passed with stated limits | Three-width live QA passed; PayPal displayed `Docked Cruise D2` at `$299.00 AUD`; no payment was submitted. |
| Public HTTPS verification | HTTPS live; enforcement pending | Valid HTTPS returned the current storefront; `www` redirected to the HTTPS apex. Plain `http://docked.com.au/` still returned `200` instead of redirecting, and no HSTS header was present. |

## Final deployment record

- Reviewed price implementation commit: `f454fde58805c5d6b8b46b2e953398601fb91386` (pushed)
- Owner instruction: update the website after changing the PayPal product price to `$299`, received in the active session before production promotion
- Production commit: `6086b28690b28cc5df01d521982bfa4d4e6d02a8` (exact four changed public files)
- Previous production commit: `5be6e075d6d72bf6ebc8c96b131b7fa257465868`
- GitHub Pages run: workflow `pages build and deployment`, run `102`, run ID `33383154217`, [successful](https://github.com/bginty/docked/actions/runs/33383154217), completed 31 August 2026 at 20:36:34 AEST
- GitHub Pages deploy job: job ID `99459811102`, completed with `success`
- Production tag: `docked-static-paypal-launch-2026-08` remains the immutable initial-launch tag (annotated tag object `c9510d884b79248d98f837047d10cc7fd9762c3d`, peeled commit `a4d9075e13a90a03a8587b5641626f0d42a36160`); it was not moved for this price revision.
- Live verification: completed after Pages run #102 at 320, 390, and 1440 CSS pixels; observation window ended approximately 20:41 AEST
- Logged-out production URL: `https://docked.com.au`

The live audit confirmed the unchanged summer storefront with a `$299` / `AUD · Free shipping` offer and the production PayPal Hosted Button at `$299.00 AUD`. No visible `$649` remained. At every inspected viewport there was no horizontal overflow or broken image. The changed homepage, product configuration, Shipping & Returns page, and Terms page matched the reviewed production files after expected line-ending normalization. Product/Offer JSON-LD reported `299` and `AUD`. The HTTPS apex returned `200` and `www` redirected to it. Plain HTTP still returned `200` without redirecting and no HSTS header was present, so HTTPS enforcement remains pending. A real payment, seller-side transaction record, payment email, refund, and PayPal return URL remain deliberately untested. No Lighthouse, automated accessibility, or universally console-clean result is claimed.
