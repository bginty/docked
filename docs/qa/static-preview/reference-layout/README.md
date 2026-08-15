# Screenshot-reference layout QA

Local candidate evidence captured on 15 August 2026.

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

Additional 390 px evidence:

- `checkout-390.png` records the on-page `$649` offer and the top of the rendered PayPal purchase card.
- `footer-bottom-390.png` records the seller, ABN and support details in the bottom footer.

PayPal was inspected at 390 and 1440 CSS pixels. The hosted widget rendered `Docked Cruise D2` at `$649.00 AUD`; no checkout control was activated.

These files are local rendered-QA evidence. The candidate source commit, production commit and live deployment are pending. No Lighthouse result, automated accessibility result or console-clean result is claimed here.
