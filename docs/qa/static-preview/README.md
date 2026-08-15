# Static preview QA

Observation window: 15 August 2026, 15:55–16:43 AEST

Candidate: local working tree based on `b26add982e5f4c7cfab2b13f74a14500d7199530`; final commit pending.

## Browser checks

- Homepage, Safety, Shipping and Returns, Privacy, Terms, Thank You and a missing legacy route rendered from the local static server.
- Each tested route had one visible H1, a main landmark, working navigation and no horizontal overflow in the inspected desktop viewport.
- The missing route showed the branded 404 page.
- The mobile menu opened at 320px, exposed `aria-expanded=true`, and closed with Escape.
- Gallery pointer selection and Arrow Left keyboard movement updated the selected tab and visible panel.
- Local links, fragments, image references, JavaScript syntax and page semantics are also covered by the deterministic validator and Node tests.
- Final local source checks: `npm run validate` passed 26/26 and `npm test` passed 5/5.

## Responsive matrix

DOM-based responsive checks used same-origin frames at 320, 375, 390, 768, 1024 and 1440 CSS pixels. At every width, document scroll width was no greater than the CSS viewport width. At 320px, `scrollWidth` and `innerWidth` were both 320px; the 15px client-width difference was the vertical scrollbar rather than page overflow. The mobile menu was visible through 768px and replaced by desktop navigation at 1024px and above. The PayPal-enabled page rendered at every width, and the 320px hero actions stacked without leaving the viewport.

The six PNG files in this folder are visual reference captures from the pre-checkout-layout run. Browser-window chrome can make a nominal headless capture differ from its requested CSS viewport, so they are not used as the sole width evidence. The later DOM measurements are the authoritative responsive evidence. The PayPal-enabled ordering card was separately inspected in the in-app browser and fit its responsive container.

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

## Limits

- The site uses original abstract brand illustrations, not exact-product photography.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- The final PayPal-enabled load produced PayPal's own `ncps_standalone_paylater_ineligible` console message while the hosted button remained rendered and functional. No first-party Docked JavaScript error was observed. Earlier Apple Pay eligibility messages came from PayPal's embedded surface and are not reported as a clean-console pass.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- Production-domain checks remain pending until GitHub Pages deploys the exact production commit.
