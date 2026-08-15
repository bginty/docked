# Screenshot-reference layout QA

Local and live production evidence captured on 15 August 2026.

## Scope

- Approved hierarchy: compact header, complete feature board first, product label, headline, supporting copy, offer, primary purchase action, secondary feature action and concise feature line.
- Price presentation: `$649` followed by `AUD`; PayPal rendered `$649.00 AUD`.
- Shipping presentation: `Free shipping`, without a geographic qualifier.
- Seller disclosure: Ginty United Investments Pty Ltd, ABN and `support@docked.com.au` appear in the homepage's bottom footer rather than its sales content.
- Mobile purchase target: `#checkout`.
- Payment boundary: no payment details were entered and no transaction was submitted.

## Captures

| Requested viewport | Evidence |
| --- | --- |
| 320 px | `homepage-320.png` |
| 360 px | `homepage-360.png` |
| 390 px | `homepage-390.png` |
| 430 px | `homepage-430.png` |
| 768 px | `homepage-768.png` |
| 1024 px | `homepage-1024.png` |
| 1440 px | `homepage-1440.png` |

Additional local 390 px evidence:

- `checkout-390.png` records the on-page `$649` offer and the top of the rendered PayPal purchase card.
- `footer-bottom-390.png` records the seller, ABN and support details in the bottom footer.

PayPal was inspected at 390 and 1440 CSS pixels. The hosted widget rendered `Docked Cruise D2` at `$649.00 AUD`; no checkout control was activated.

## Live production evidence

- `live-homepage-390.png` records the deployed first-visual hierarchy and `$649` / `AUD · Free shipping` offer.
- `live-checkout-390.png` records the deployed on-page offer and rendered PayPal purchase card.
- `live-footer-bottom-390.png` records the seller, ABN and support details at the bottom of the deployed homepage.

Live Browser QA covered 320, 360, 390, 430, 768, 1024 and 1440 CSS pixels. At every inspected size, document `scrollWidth` equalled `clientWidth`, the complete feature image remained contained and the secondary hero action remained visible. The page displayed no `A$` notation or `worldwide` shipping qualifier; company, ABN and support-email text did not appear above the bottom footer. PayPal rendered `$649.00 AUD`, and the purchase CTA resolved to `#checkout`.

The reviewed source implementation is commit `777b09037e0f78e627cef09e710b05f0c4d88ff6`; its exact eight-file production payload is `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`. GitHub Pages [run #100](https://github.com/bginty/docked/actions/runs/31883818055) and deployment ID `5920263065` completed successfully at `2026-08-15T12:08:17Z`.

No payment details were entered and no transaction was submitted. No Lighthouse result, automated accessibility result or console-clean result is claimed here. Plain `http://docked.com.au/` still returned `200` without redirecting and remains an HTTPS-enforcement caveat.
