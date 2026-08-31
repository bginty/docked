# Cruise D2 $299 production QA

Date: 31 August 2026 (AEST)

## Release identity

- Owner instruction: update the Docked website after changing the PayPal product price to `$299`.
- Reviewed source commit: `f454fde58805c5d6b8b46b2e953398601fb91386`.
- Exact public production commit: `6086b28690b28cc5df01d521982bfa4d4e6d02a8`.
- Previous production commit: `5be6e075d6d72bf6ebc8c96b131b7fa257465868`.
- Public allowlist: `assets/js/product-config.js`, `index.html`, `shipping-returns.html`, and `terms.html`.
- GitHub Pages run: [#102](https://github.com/bginty/docked/actions/runs/33383154217), run ID `33383154217`, completed successfully for the exact production SHA at 20:36:34 AEST.
- Deploy job: `99459811102`, completed successfully.

## Automated checks

- `npm run validate`: 51/51 passed, including the secret scan and a new stale-`$649` public-copy guard.
- `npm test`: 15/15 passed.
- JavaScript syntax checks: passed for `product-config.js`, `site.js`, the validator, and the test suite.
- `git diff --check`: passed.
- The production staging allowlist contained exactly the four expected public files and their content matched the reviewed source commit.

## Rendered verification

Local and logged-out live Browser QA passed at 320, 390, and 1440 CSS pixels. At every inspected width:

- the Docked offer rendered `$299` with `AUD · Free shipping`;
- the PayPal Hosted Button rendered `Docked Cruise D2` at `$299.00 AUD`;
- no visible `$649` remained;
- document `scrollWidth` equalled `clientWidth`;
- no broken image was detected; and
- the feature image and hero purchase action were visible.

The deployed Shipping & Returns and Terms pages both rendered `$299 AUD` and contained no `$649 AUD`. The live JSON-LD Product offer rendered price `299` and currency `AUD`. The four public files matched the reviewed production files after the expected GitHub Pages CRLF-to-LF text normalization.

The browser console recorded PayPal's third-party `ncps_standalone_paylater_ineligible` diagnostic. No first-party Docked error was observed. No buyer data was entered, the checkout control was not activated, and no payment was submitted.

## Domain verification

- `https://docked.com.au/`: `200`.
- `https://www.docked.com.au/`: `301` to `https://docked.com.au/`.
- `http://docked.com.au/`: still `200`, with no HTTP-to-HTTPS redirect and no HSTS header. HTTPS enforcement therefore remains pending and was not changed by this price-only release.

## Screenshot

- `live-homepage-390.jpg`: full-page live capture at a requested 390 CSS-pixel viewport after Pages run #102 completed.

