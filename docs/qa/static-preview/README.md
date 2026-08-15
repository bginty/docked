# Static preview QA

Local observation window: 15 August 2026, 15:55–16:43 AEST

Production observation window: 15 August 2026, 17:31:41–17:36:28 AEST

Candidate: tested working commit `be44b0d34be1987b3bdc13bd2ce864b02182b55e`; public Pages output commit `a4d9075e13a90a03a8587b5641626f0d42a36160`.

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

## Production-domain verification

- GitHub Pages workflow [run #97](https://github.com/bginty/docked/actions/runs/31872052450) completed successfully for exact commit `a4d9075e13a90a03a8587b5641626f0d42a36160`.
- `https://docked.com.au/` returned the new `Docked Cruise D2 | Dual-Motor Adult Pool Lounger` site over a valid TLS connection; `https://www.docked.com.au/` redirected to the HTTPS apex.
- The live homepage rendered the PayPal Hosted Button for `Docked Cruise D2`, `A$649.00 AUD`, quantity 1 to 10. Opening checkout reached `https://www.paypal.com/ncp/payment/FGAUDYCA2LX36` and showed a quantity-one total of `$649.00 AUD`. No payment data was entered and no transaction was completed.
- Live 320px and 1440px checks showed no page-wide horizontal overflow. At 320px the menu opened with `aria-expanded=true`, exposed the main navigation, and closed again.
- Safety, Shipping and Returns, Privacy and Terms rendered with their intended titles and H1 headings. An unknown route returned the custom `Page Not Found | Docked` page with H1 `We couldn’t find it.`
- A same-origin crawl found 14 references with no broken targets or fragment links. All current public files returned `200`; all 14 checked finance-only legacy routes and assets returned the custom 404.
- The live homepage contained the expected PayPal public client identifier, Hosted Button ID `FGAUDYCA2LX36`, `currency=AUD`, public price `649`, worldwide shipping copy and `18+` control. Checked finance phrases and Shopify references were absent from the public output.
- HTTPS availability passed, but enforcement did not: plain `http://docked.com.au/` returned `200` instead of redirecting, and GitHub's Pages API reported `https_enforced: false`.

## Limits

- The site uses original abstract brand illustrations, not exact-product photography.
- Lighthouse was not run because a Lighthouse executable was not installed in the workspace. No target score is reported as achieved.
- The final PayPal-enabled load produced PayPal's own `ncps_standalone_paylater_ineligible` console message while the hosted button remained rendered and functional. No first-party Docked JavaScript error was observed. Earlier Apple Pay eligibility messages came from PayPal's embedded surface and are not reported as a clean-console pass.
- A real payment, PayPal seller-account transaction record, payment email and refund were not tested or claimed.
- GitHub Pages has deployed and the production-domain checks above are complete. HTTP-to-HTTPS enforcement remains an infrastructure follow-up and is not reported as passed.
