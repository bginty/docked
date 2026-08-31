# Static preview QA

Price-change local and production QA: 31 August 2026, live observation through approximately 20:41 AEST

Summer-feedback local and production QA: 16 August 2026, live observation through approximately 10:05 AEST

Reference-layout local and production QA: 15 August 2026

Feature-board candidate observation window: 15 August 2026, 20:15–20:20 AEST

Feature-board production observation window: 15 August 2026, 20:42–20:44 AEST

Current deployed product-led revision observation window: 15 August 2026, 18:03–18:20 AEST

Initial-launch production observation window: 15 August 2026, 17:31:41–17:36:28 AEST

Current deployed reviewed source implementation commit: `f454fde58805c5d6b8b46b2e953398601fb91386`; exact public Pages output commit: `6086b28690b28cc5df01d521982bfa4d4e6d02a8`. The previous public commit was `5be6e075d6d72bf6ebc8c96b131b7fa257465868`. The owner explicitly instructed that the website be updated after changing the PayPal product price to `$299`.

## $299 price revision — local and live QA passed

The current production price-only release is recorded in [`price-299/`](./price-299/). Exactly four public files changed: the product configuration, homepage, Shipping & Returns page, and Terms page. The live website offer, purchase calls to action, policy references, Product/Offer structured data, and PayPal Hosted Button now agree at `$299 AUD` / `$299.00 AUD`.

`npm run validate` passed 51/51 checks and `npm test` passed 15/15. Local and live Browser QA passed at 320, 390, and 1440 CSS pixels with no horizontal overflow, broken image, or stale visible `$649`. GitHub Pages [run #102](https://github.com/bginty/docked/actions/runs/33383154217) completed successfully for exact production commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8`. The deployed files matched the reviewed production files after expected line-ending normalization. No buyer data was entered and no payment was submitted.

## Historical summer-feedback revision — local and live QA passed

The owner-approved and deployed summer-feedback revision is recorded in [`summer-feedback/`](./summer-feedback/). It keeps the current Docked logo, `Cruise D2` name, `$649 AUD · Free shipping` offer and PayPal Hosted Button configuration while adding the brighter palette, approved man and woman lifestyle-image derivatives, simplified copy hierarchy, accessible three-panel slideshow and a contextual persistent `#checkout` call to action. The purchase bar hides whenever the hero action, checkout or final action is visible and appears only when no alternate purchase surface is in view.

The feature-board and both lifestyle sources contain C2PA provenance identifying `gpt-image v2.0` / `trainedAlgorithmicMedia`. Their public derivatives use deterministic processing but retain that AI source provenance. The live page labels the feature board visibly as “Supplier product illustration” and each lifestyle image as “Supplier lifestyle illustration”; their alt text also identifies them as illustrations.

The deployed feature board removes the unsupported “Strong and stable design for a safe and comfortable ride.” paragraph with a deterministic pool-water patch and adds no replacement claim. The supplied depiction, retained callouts and overall layout are preserved. No independent speed/performance or 160 kg load-bearing test was supplied or reviewed, so owner approval is not treated as technical substantiation for the removed qualitative safety/comfort wording.

Recorded local automated results:

- `npm run validate`: 51/51 passed;
- `npm test`: 15/15 passed;
- JavaScript syntax checks: passed for the two public scripts, validator and test file; and
- `git diff --check`: passed.

Fresh local Browser QA passed at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. All seven viewports had no horizontal overflow or broken image, showed the three visible supplier-illustration disclosures, kept the man illustration at a 1.5 rendered aspect ratio with `min-height: 0px`, and applied the contextual purchase-bar rule correctly. At 390 pixels, gallery click and `ArrowRight` navigation reached `Poolside`; the mobile menu opened and closed with `Escape`; two PayPal iframes rendered `Docked Cruise D2` at `$649.00 AUD`; and the persistent CTA reached `#checkout` with the heading approximately 112 pixels from the viewport top and the bar hidden. Six screenshots are in [`summer-feedback/`](./summer-feedback/).

No first-party Docked console error was observed locally. Local PayPal emitted `ncps_standalone_paylater_ineligible` and Apple Pay configuration messages from its third-party integration. No payment or Lighthouse run was performed.

After owner authorization, Pages [run #101](https://github.com/bginty/docked/actions/runs/31915757230) completed successfully for exact production commit `5be6e075d6d72bf6ebc8c96b131b7fa257465868` at 09:51:00 AEST on 16 August 2026. Deployment ID `5925876775`, status ID `16863925709`, reached `success` at 09:50:59 AEST. All eight production paths returned `200` and matched the deployed files byte-for-byte or after expected text normalization; 24 local references across seven public pages returned `200`, with no finance copy. The seven-width live matrix passed with no horizontal overflow or visible broken image, all three illustration disclosures visible, the man illustration at a 1.5 ratio with `min-height: 0px`, `$649`, two PayPal iframes and correct contextual-bar visibility. The only recorded live console diagnostic was PayPal's third-party `ncps_standalone_paylater_ineligible`.

## Screenshot-reference production revision

The deployed revision implements the owner-approved screenshot hierarchy without changing the product evidence or checkout provider:

- the complete Cruise D2 feature board is the first major visual immediately below the header and is shown without cropping;
- the sales sequence is product label, headline, supporting copy, `$649` price with `AUD`, primary purchase action, secondary feature action and the concise feature line;
- the visible offer uses `$649 AUD` and `Free shipping`; the superseded `A$` notation and geographic shipping qualifier are absent from the live customer-facing page;
- the company name, ABN and support email have been removed from the homepage sales content and consolidated in the bottom footer; and
- the mobile purchase action resolves to `#checkout`.

Rendered Browser QA was performed locally and again on the live domain at requested outer viewports of 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. At each live viewport, document `scrollWidth` equalled `clientWidth`, the complete feature image used contain-style rendering and the secondary hero action remained visible. Captures are in [`reference-layout/`](./reference-layout/). The PayPal Hosted Button rendered `Docked Cruise D2` at `$649.00 AUD`; the purchase action resolved to `#checkout`. Static validation passed 41/41 and the Node suite passed 10/10 before deployment. No checkout control was activated, no buyer or payment data was entered and no payment was submitted.

The reviewed implementation commit `777b09037e0f78e627cef09e710b05f0c4d88ff6` was pushed on `codex/docked-static-paypal-launch`. Its exact eight-file public payload is production commit `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`. GitHub Pages [run #100](https://github.com/bginty/docked/actions/runs/31883818055) completed successfully. Live screenshots and this post-deployment record were created after the reviewed implementation commit; they do not alter the deployed eight-file payload.

No new console-clean, Lighthouse-score or automated accessibility claim is made for this revision. Those checks require their own recorded evidence and are not inferred from the responsive screenshots.

## Previously deployed feature-board revision

The deployed feature-board revision added `assets/images/product/cruise-d2-features.jpg` from the owner-supplied supplier file `C:\Users\61412\Desktop\1000047443.png` (405,229 bytes, 1536 × 1536, SHA-256 `93E1A9A811B851185F1B9335850A99561B8B54994A2FD46AA147F0E912A7054C`). The source is JPEG/JFIF despite its `.png` filename. The 507,583-byte public derivative is also 1536 × 1536 JPEG/JFIF and has SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`.

The owner confirmed the supplier source, product identity and publication authority, and separately confirmed the six retained product facts. The candidate deterministically replaces the source's unsupported safety/stability sentence with “Maximum supported load: 160 kg.” No independent speed/performance test or 160 kg load-bearing test was reviewed.

Candidate QA results:

- `npm run validate`: 37/37 passed.
- `npm test`: 8/8 passed.
- Responsive browser checks passed with requested outer viewports of 360, 390, 430, 768, 1024 and 1440 CSS pixels; the browser's 15-pixel vertical scrollbar produced content/capture widths of 345, 375, 415, 753, 1009 and 1425 pixels respectively. At every size document `scrollWidth` equalled `clientWidth`, so there was no horizontal overflow.
- The 1536 × 1536 feature board rendered uncropped at 332.8 × 332.8 CSS pixels in the 360-pixel view, remained inside the viewport and opened through the full-size image link.
- Hero price and purchase CTA were visible at 360 pixels; desktop hero price and both purchase actions were visible above the fold at 1280 × 720.
- Mobile navigation opened, closed and updated its accessible label; purchase links resolved to `#checkout`; the mobile order bar appeared only after the hero and remained hidden while checkout was visible.
- The specification list exposed exactly the six confirmed values and suppressed the null unknown fields.
- PayPal rendered `Docked Cruise D2`, `$649.00 AUD`, quantity 1–10 and the checkout control; no field was completed and no payment was attempted.
- Contact and Warranty pages rendered with their intended titles, H1 headings and customer/legal information.
- The live-widget console emitted PayPal's own `ncps_standalone_paylater_ineligible` diagnostic; no first-party Docked JavaScript error was observed.

Captured evidence is stored in `docs/qa/static-preview/feature-revision/`: `homepage-360.png`, `homepage-390.png`, `homepage-430.png`, `homepage-768.png`, `homepage-1024.png`, `homepage-1440.png`, `feature-360.png` and `checkout-390.png`. Filenames identify the requested browser viewport; raster width records the scrollbar-adjusted content viewport described above.

The source revision is commit `06d4bd1941517b79c10a72a59d581969afd58f31`. Its exact public allowlist is production commit `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`, deployed successfully by Pages run #99. Live evidence files added after deployment are `live-homepage-390.png`, `live-feature-390.png` and `live-checkout-390.png`.

## Previously deployed browser checks

- The current homepage rendered its supplier-image hero, product overview, ordering card, product gallery and PayPal Hosted Button in the inspected desktop viewport.
- It had one visible H1, a main landmark, complete accessible names for the product images and no horizontal overflow (`scrollWidth` equalled `clientWidth`).
- The product image derivatives loaded successfully. Selecting the `Controls` gallery tab updated `aria-selected`, exposed `gallery-panel-3` and loaded the registered controls derivative.
- The live DOM contained one understated `18+` mention beside ordering; the detailed warning content remains on the Safety page.
- Local links, fragments, image references, JavaScript syntax and page semantics are also covered by the deterministic validator and Node tests.
- Final local source checks: `npm run validate` passed 37/37 and `npm test` passed 8/8.

## Responsive matrix

The summer-feedback revision passed local and live rendered inspection at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. At every live size there was no horizontal overflow or visible broken image, all three illustration disclosures were visible, the man illustration retained its 1.5 ratio with `min-height: 0px`, and the contextual purchase bar was hidden at the hero, checkout and final action while visible mid-page. At 390 pixels, keyboard gallery navigation reached `Poolside`, the mobile menu opened and closed with `Escape`, and the persistent CTA reached `#checkout` with its heading approximately 112 pixels from the viewport top. Three live captures and six local captures are in `docs/qa/static-preview/summer-feedback/`.

The preceding screenshot-reference revision passed its historical local and live rendered inspection at the same seven widths. Its captures remain in `docs/qa/static-preview/reference-layout/`.

The initial static launch also passed same-origin responsive checks at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Those measurements and the six PNG files in this folder predate both the feature-board revision and the screenshot-reference candidate, and remain historical baseline evidence only.

## PayPal hosted checkout

Hosted button ID: `FGAUDYCA2LX36`

- Button rendered: passed.
- Product name: `Docked Cruise D2` — passed.
- Live website price: `$299 AUD` — passed.
- Currency and quantity-one total: `$299.00 AUD` — passed.
- Live shipping copy: `Free shipping`, with no geographic qualifier — passed.
- Current price-release local and live viewports: 320, 390, and 1440 CSS pixels — passed. The earlier seven-width layout evidence remains recorded above.
- Mobile purchase target: `#checkout` — passed.
- Real payment: not run.
- Card, address and identity fields: no data entered.
- Return to `thank-you.html`: not verified because no real payment was authorised.

## Production-domain verification

- GitHub Pages workflow [run #102](https://github.com/bginty/docked/actions/runs/33383154217) completed successfully for exact production commit `6086b28690b28cc5df01d521982bfa4d4e6d02a8` at 20:36:34 AEST on 31 August 2026.
- Build, status-report, and deploy jobs all completed successfully; the deploy job ID is `99459811102`.
- All four price-release paths matched the local production files after expected CRLF-to-LF text normalization.
- `https://docked.com.au/` returned `200` over HTTPS; `https://www.docked.com.au/` redirected to the HTTPS apex.
- The complete Cruise D2 feature image remained the first major visual at all three current-release viewports.
- The live offer rendered `$299` with `AUD · Free shipping`; no stale `$649`, `A$` notation, or `worldwide` shipping qualifier was visible.
- Ginty United Investments Pty Ltd, ABN 78 606 187 106 and `support@docked.com.au` did not appear above the bottom footer.
- The live PayPal Hosted Button displayed `Docked Cruise D2` at `$299.00 AUD`. No payment data was entered and no transaction was completed.
- At requested viewports of 320, 390, and 1440 CSS pixels there was no horizontal overflow or visible broken image, and no stale `$649` appeared.
- Current price-release evidence is `docs/qa/static-preview/price-299/live-homepage-390.jpg`; the earlier interaction and seven-width screenshots remain in their historical folders.
- No first-party Docked console error was observed; the only recorded live diagnostic was PayPal's third-party `ncps_standalone_paylater_ineligible`.
- HTTPS availability passed, but enforcement did not: plain `http://docked.com.au/` returned `200` instead of redirecting, and no HSTS header was present.

## Limits

- The deployed revision uses deterministic derivatives of owner-approved supplier imagery. The summer-feedback feature-board and lifestyle sources are C2PA-declared `gpt-image v2.0` / `trainedAlgorithmicMedia`, so their deterministic public derivatives are visibly labelled supplier illustrations rather than presented as documentary photographs. Source custody, processing and derivative hashes are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- No universally console-clean result is claimed: there was no first-party Docked error, but PayPal emitted `ncps_standalone_paylater_ineligible` during the live pass.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- GitHub Pages has deployed and the production-domain checks above are complete. HTTP-to-HTTPS enforcement remains an infrastructure follow-up and is not reported as passed.
