# Static preview QA

Reference-layout local and production QA: 15 August 2026

Feature-board candidate observation window: 15 August 2026, 20:15–20:20 AEST

Feature-board production observation window: 15 August 2026, 20:42–20:44 AEST

Current deployed product-led revision observation window: 15 August 2026, 18:03–18:20 AEST

Initial-launch production observation window: 15 August 2026, 17:31:41–17:36:28 AEST

Current reviewed source implementation commit: `777b09037e0f78e627cef09e710b05f0c4d88ff6`; public Pages output commit: `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`.

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

The screenshot-reference revision passed local and live rendered inspection at 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. Its seven local full-page captures and three 390-pixel live captures are in `docs/qa/static-preview/reference-layout/`. At every live size, document `scrollWidth` equalled `clientWidth`, the feature image remained contained and the secondary hero action was visible.

The initial static launch also passed same-origin responsive checks at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Those measurements and the six PNG files in this folder predate both the feature-board revision and the screenshot-reference candidate, and remain historical baseline evidence only.

## PayPal hosted checkout

Hosted button ID: `FGAUDYCA2LX36`

- Button rendered: passed.
- Product name: `Docked Cruise D2` — passed.
- Live website price: `$649 AUD` — passed.
- Currency and quantity-one total: `$649.00 AUD` — passed.
- Live shipping copy: `Free shipping`, with no geographic qualifier — passed.
- Inspected local and live viewports: 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels — passed.
- Mobile purchase target: `#checkout` — passed.
- Real payment: not run.
- Card, address and identity fields: no data entered.
- Return to `thank-you.html`: not verified because no real payment was authorised.

## Production-domain verification

- GitHub Pages workflow [run #100](https://github.com/bginty/docked/actions/runs/31883818055) completed successfully for exact production commit `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`. Run ID `31883818055` was created at `2026-08-15T12:07:55Z` and completed at `2026-08-15T12:08:17Z`.
- Deployment ID `5920263065`, status ID `16849484631`, reached `success`; it was created at `2026-08-15T12:08:05Z` and completed at `2026-08-15T12:08:17Z`.
- `https://docked.com.au/` returned `200` over HTTPS; `https://www.docked.com.au/` redirected to the HTTPS apex.
- The complete Cruise D2 feature image was the first major visual and remained contained at all seven inspected live viewports.
- The live offer rendered `$649` with `AUD · Free shipping`. No `A$` notation or `worldwide` shipping qualifier was visible.
- Ginty United Investments Pty Ltd, ABN 78 606 187 106 and `support@docked.com.au` did not appear above the bottom footer.
- The live PayPal Hosted Button rendered `Docked Cruise D2` at `$649.00 AUD`, and the purchase CTA resolved to `#checkout`. No checkout control was activated, no payment data was entered and no transaction was completed.
- At requested viewports of 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels, document `scrollWidth` equalled `clientWidth`, the feature image remained contained and the secondary hero action remained visible.
- Live evidence files are `live-homepage-390.png`, `live-checkout-390.png` and `live-footer-bottom-390.png` in `docs/qa/static-preview/reference-layout/`.
- HTTPS availability passed, but enforcement did not: plain `http://docked.com.au/` returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`.

## Limits

- The homepage uses deterministic crops of owner-approved supplier images plus the deterministic text-redacted feature board. A full-frame generated edit was rejected and is not published. Source custody and derivative hashes are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- No console-clean result is claimed for the screenshot-reference production revision.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- GitHub Pages has deployed and the production-domain checks above are complete. HTTP-to-HTTPS enforcement remains an infrastructure follow-up and is not reported as passed.
