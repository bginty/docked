# Static preview QA

Current product-led revision observation window: 15 August 2026, 18:03–18:20 AEST

Initial-launch production observation window: 15 August 2026, 17:31:41–17:36:28 AEST

Candidate: tested working commit `f3475f2d60aa7ce011b726cf6a4d6050c8baee39`; public Pages output commit `5aceddc9726d7d2617c8e2e09c1b4f290f87e633`.

## Browser checks

- The current homepage rendered its supplier-image hero, product overview, ordering card, product gallery and PayPal Hosted Button in the inspected desktop viewport.
- It had one visible H1, a main landmark, complete accessible names for the product images and no horizontal overflow (`scrollWidth` equalled `clientWidth`).
- The product image derivatives loaded successfully. Selecting the `Controls` gallery tab updated `aria-selected`, exposed `gallery-panel-3` and loaded the registered controls derivative.
- The live DOM contained one understated `18+` mention beside ordering; the detailed warning content remains on the Safety page.
- Local links, fragments, image references, JavaScript syntax and page semantics are also covered by the deterministic validator and Node tests.
- Final local source checks: `npm run validate` passed 28/28 and `npm test` passed 5/5.

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

- GitHub Pages workflow [run #98](https://github.com/bginty/docked/actions/runs/31874058651) completed successfully for exact commit `5aceddc9726d7d2617c8e2e09c1b4f290f87e633`; deployment ID `5918633369` reached `success` at `2026-08-15T08:16:35Z`.
- `https://docked.com.au/` returned the product-led `Docked Cruise D2 | Motorised Pool Lounger` site over a valid TLS connection; `https://www.docked.com.au/` redirected to the HTTPS apex.
- The live hero, overview and controls product derivatives returned `200 image/webp`. The hero and overview loaded immediately; selecting `Controls` loaded the lazy gallery image and changed the selected tab/panel correctly.
- The live homepage rendered the PayPal Hosted Button for `Docked Cruise D2`, `A$649.00 AUD`, quantity 1 to 10. No checkout button was activated, no payment data was entered and no transaction was completed during this revision check.
- The inspected desktop viewport had no page-wide horizontal overflow. Fresh rendered mobile dimensions were not available in the current browser environment and are not reported as passed for this revision.
- Safety, Shipping and Returns, Privacy and Terms rendered with their intended titles and H1 headings. An unknown route returned the custom `Page Not Found | Docked` page with H1 `We couldn’t find it.`
- A same-origin crawl found 14 references with no broken targets or fragment links. All current public files returned `200`; all 14 checked finance-only legacy routes and assets returned the custom 404.
- The live homepage contained the expected PayPal public client identifier, Hosted Button ID `FGAUDYCA2LX36`, `currency=AUD`, public price `649`, worldwide shipping copy and one quiet `18+` eligibility notice. Checked finance phrases and Shopify references were absent from the public output.
- HTTPS availability passed, but enforcement did not: plain `http://docked.com.au/` returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`.

## Limits

- The homepage now uses deterministic crops of owner-approved supplier images depicting the Docked product. The promotional source overlays were excluded, and no image was generatively reconstructed. Source custody and derivative hashes are recorded in `docs/STATIC_SITE_ASSET_REGISTER.md`.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- The current live PayPal-enabled load produced PayPal's own `ncps_standalone_paylater_ineligible`, Apple Pay configuration and eligibility messages while the hosted button remained rendered. No first-party Docked JavaScript error was observed; this is not reported as a zero-message console pass.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- GitHub Pages has deployed and the production-domain checks above are complete. HTTP-to-HTTPS enforcement remains an infrastructure follow-up and is not reported as passed.
