# Static preview QA

Feature-board candidate observation window: 15 August 2026, 20:15–20:20 AEST

Feature-board production observation window: 15 August 2026, 20:42–20:44 AEST

Current deployed product-led revision observation window: 15 August 2026, 18:03–18:20 AEST

Initial-launch production observation window: 15 August 2026, 17:31:41–17:36:28 AEST

Current deployed source commit: `06d4bd1941517b79c10a72a59d581969afd58f31`; public Pages output commit: `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`.

## Feature-board revision

The current working tree adds `assets/images/product/cruise-d2-features.jpg` from the owner-supplied supplier file `C:\Users\61412\Desktop\1000047443.png` (405,229 bytes, 1536 × 1536, SHA-256 `93E1A9A811B851185F1B9335850A99561B8B54994A2FD46AA147F0E912A7054C`). The source is JPEG/JFIF despite its `.png` filename. The 507,583-byte public derivative is also 1536 × 1536 JPEG/JFIF and has SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`.

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

## Browser checks

- The current homepage rendered its supplier-image hero, product overview, ordering card, product gallery and PayPal Hosted Button in the inspected desktop viewport.
- It had one visible H1, a main landmark, complete accessible names for the product images and no horizontal overflow (`scrollWidth` equalled `clientWidth`).
- The product image derivatives loaded successfully. Selecting the `Controls` gallery tab updated `aria-selected`, exposed `gallery-panel-3` and loaded the registered controls derivative.
- The live DOM contained one understated `18+` mention beside ordering; the detailed warning content remains on the Safety page.
- Local links, fragments, image references, JavaScript syntax and page semantics are also covered by the deterministic validator and Node tests.
- Final local source checks: `npm run validate` passed 37/37 and `npm test` passed 8/8.

## Responsive matrix

The initial static launch passed same-origin responsive checks at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Those measurements predate the current product-media revision and are retained only as historical baseline evidence.

For the current revision, CSS/source contracts and the deterministic tests cover the mobile navigation, stacked hero actions and mobile ordering bar. The live browser was fixed at a desktop viewport, so a fresh rendered 320–768px matrix was not claimed. The six PNG files in this folder remain historical visual references from earlier layouts and are not evidence for the current revision.

## PayPal hosted checkout

Hosted button ID: `FGAUDYCA2LX36`

- Button rendered: passed.
- Product name: `Docked Cruise D2` — passed.
- Unit price: `A$649.00` — passed.
- Currency and quantity-one total: `$649.00 AUD` — passed.
- Delivery information: card flow requested address fields and exposed countries worldwide — passed for the owner's worldwide-delivery instruction.
- Shipping charge: no additional shipping amount appeared; owner separately approved free shipping worldwide.
- Real payment: not run.
- Card, address and identity fields: no data entered.
- Return to `thank-you.html`: not verified because no real payment was authorised.

## Production-domain verification

- GitHub Pages workflow [run #99](https://github.com/bginty/docked/actions/runs/31880122836) completed successfully for exact commit `480b5ed11d65bc5c932a54aaf66f99f91fa1e994`; deployment ID `5919624892` reached `success` at `2026-08-15T10:41:09Z`.
- `https://docked.com.au/` returned `Docked Cruise D2 | Motorised Inflatable Water Lounger Australia` over a valid TLS connection; `https://www.docked.com.au/` continued to redirect to the HTTPS apex.
- The live feature-board asset returned `200`, 1536 × 1536 JPEG/JFIF and exact registered SHA-256 `3BA244A638F4B9A0A612A6A01AD98D9B940BFCF8B2881593F3F76D272835A523`. It rendered uncropped and inside the 390-pixel browser viewport.
- The live homepage rendered four purchase CTAs targeting `#checkout`, the PayPal Hosted Button for `Docked Cruise D2` at `A$649`, quantity 1 to 10, and one quiet `18+` eligibility notice. No checkout control was activated, no payment data was entered and no transaction was completed.
- At requested viewports of 390 and 1440 CSS pixels, document `scrollWidth` equalled `clientWidth`; there were no broken loaded images. On desktop, price and the primary purchase action were above the fold.
- Contact, Warranty, Safety, Shipping and Returns, Privacy, Terms and Thank You returned `200` with intended titles. An unknown route returned the custom 404.
- Checked finance phrases and Shopify references were absent from the public output.
- HTTPS availability passed, but enforcement did not: plain `http://docked.com.au/` returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`.

## Limits

- The homepage uses deterministic crops of owner-approved supplier images plus the deterministic text-redacted feature board. A full-frame generated edit was rejected and is not published. Source custody and derivative hashes are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- The current live PayPal-enabled load produced PayPal's own `ncps_standalone_paylater_ineligible`, Apple Pay configuration and eligibility messages while the hosted button remained rendered. No first-party Docked JavaScript error was observed; this is not reported as a zero-message console pass.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- GitHub Pages has deployed and the production-domain checks above are complete. HTTP-to-HTTPS enforcement remains an infrastructure follow-up and is not reported as passed.
