# Summer-feedback candidate QA

Status: local candidate; automated and rendered QA passed; production deployment pending

Recorded: 16 August 2026 (AEST)

## Candidate identity

- Repository: `https://github.com/bginty/docked.git`
- Working branch: `codex/docked-static-paypal-launch`
- Candidate source commit: pending
- Current deployed production commit: `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`
- Production URL: `https://docked.com.au`
- Production state at record time: the preceding screenshot-reference revision remains live; this candidate is not live

This register is intentionally separate from the historical evidence in the parent [`static-preview` QA record](../README.md). Earlier screenshots and browser results do not prove the current working-tree candidate.

## Approved candidate scope

The candidate implements the owner's 16 August 2026 approval of the unambiguous design feedback supplied in `Website Ideas.eml` while retaining the current Docked logo and `Cruise D2` product name.

- Brighter summer palette using sunshine yellow, pool cyan, coral and navy.
- Feature-board-first hero remains, with the redundant hero eyebrow removed.
- `$649 AUD · Free shipping` and the existing PayPal Hosted Button remain unchanged.
- “More than a float” uses the approved man-on-float derivative; its redundant image caption is removed.
- “Control from your seat” uses the approved woman-on-float derivative.
- The specifications introduction is simplified without adding unverified facts.
- A three-panel product slideshow uses mapped tab and tabpanel semantics plus arrow-key handling.
- A contextual persistent purchase action links to the existing `#checkout` section when checkout is enabled and no alternate purchase surface is visible. It hides while the hero action, checkout or final action is in view.

The planned public payload is limited to:

- `assets/css/styles.css`
- `assets/images/product/cruise-d2-features.jpg`
- `assets/images/product/cruise-d2-lifestyle-man-1200.webp`
- `assets/images/product/cruise-d2-lifestyle-man-600.webp`
- `assets/images/product/cruise-d2-lifestyle-woman-1200.webp`
- `assets/images/product/cruise-d2-lifestyle-woman-600.webp`
- `assets/js/site.js`
- `index.html`

## Product-media evidence

The source custody, crop boxes, deterministic processing recipe, C2PA provenance and approval limits are recorded in the [static-site asset register](../../../STATIC_SITE_ASSET_REGISTER.md). The feature-board, man and woman sources contain C2PA provenance identifying `gpt-image v2.0` and the digital-source type `trainedAlgorithmicMedia`. Their crop, resize, redaction and encoding steps are deterministic and do not use a generative edit, but the underlying sources are AI-credentialed and are not represented as documentary product photographs.

The candidate page visibly labels the feature board “Supplier product illustration” and both lifestyle derivatives “Supplier lifestyle illustration”. Each corresponding image alt also identifies it as an illustration.

| Candidate asset | Dimensions | SHA-256 |
| --- | ---: | --- |
| `cruise-d2-features.jpg` | 1536 × 1536 | `CBF4A3F9508F01A17732FC24853ECEDD1B99CFE3CD3A5BEB104023DDE8FE01A7` |
| `cruise-d2-lifestyle-man-1200.webp` | 1200 × 800 | `F4000655664C9C191FA490741D69ED626B5DEA58AFCA31E6153A37FE5BAE5532` |
| `cruise-d2-lifestyle-man-600.webp` | 600 × 400 | `3F6DCFE50254F91A1C17172DB90969C92C26DFC6E136DC2893E9D395687B0221` |
| `cruise-d2-lifestyle-woman-1200.webp` | 1200 × 800 | `FFC9A0077793CE2AEE2FA310FCCC175581089695900B5F6EC4B111381F76E89B` |
| `cruise-d2-lifestyle-woman-600.webp` | 600 × 400 | `1BD22C4389CE63B689AE22F6F1D7D579714D8669D9D32ED7BB30F50E921FF0FC` |

### Safety wording decision

The supplied board's depicted product, retained headings, icons and approved factual callouts are preserved. Only the sentence “Strong and stable design for a safe and comfortable ride.” is removed with a fixed, deterministic pool-water patch; no white label, replacement text or new claim is added. The patch does not intersect the depicted product or retained callouts.

The owner approved publication of the supplied imagery and implementation of the design changes. That approval is not recorded as independent product testing. No independent speed/performance test or 160 kg load-bearing test was supplied or reviewed, so the removed qualitative safety/comfort sentence is not restored as a public performance or safety claim.

## Automated evidence

These commands were run against the current working-tree candidate on 16 August 2026.

| Check | Result | Evidence summary |
| --- | --- | --- |
| `npm run validate` | Passed | 51/51 checks passed, including byte-locked media, C2PA registration, visible illustration disclosures, claim restrictions, PayPal configuration, price/shipping copy, slideshow structure, contextual persistent CTA, links, fragments, semantic baseline and secret scan. |
| `npm test` | Passed | 15/15 Node tests passed. |
| `node --check assets/js/site.js` | Passed | No JavaScript syntax error. |
| `node --check assets/js/product-config.js` | Passed | No JavaScript syntax error. |
| `node --check scripts/validate-static-site.mjs` | Passed | No JavaScript syntax error. |
| `node --check tests/static-site.test.mjs` | Passed | No JavaScript syntax error. |
| `git diff --check` | Passed | No whitespace-error diagnostic. |

The validator confirms the static contract. It does not substitute for rendered interaction, accessibility-tool, live PayPal or production-domain testing.

## Fresh rendered QA matrix

The final local candidate was inspected at the seven requested widths on 16 August 2026. Production must be checked separately after promotion; no local result is treated as live-domain evidence.

| Requested viewport | Overflow and images | Illustration disclosure and man frame | Contextual purchase bar | Additional interaction | Screenshot evidence |
| ---: | --- | --- | --- | --- | --- |
| 320 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Viewport sweep passed | Not captured |
| 360 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Viewport sweep passed | Not captured |
| 390 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: corrected hero has no bar overlap; bar appears mid-page and hides at checkout/final action | Menu, gallery, keyboard, CTA and PayPal checks passed | Six linked captures below |
| 430 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Viewport sweep passed | Not captured |
| 768 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Viewport sweep passed | Not captured |
| 1024 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Viewport sweep passed | Not captured |
| 1440 CSS px | Passed: no horizontal overflow or broken image | Passed: all three disclosures visible; man ratio 1.5; `min-height: 0px` | Passed: hidden with hero, checkout and final action; visible between alternate purchase surfaces | Desktop viewport sweep passed | `local-hero-1440.png` |

At 390 CSS pixels:

- selecting a gallery tab and then pressing `ArrowRight` reached the `Poolside` tabpanel;
- the mobile menu opened and closed with `Escape`;
- the PayPal Hosted Button rendered two iframes and displayed `Docked Cruise D2` at `$649.00 AUD`;
- the contextual bar's link target was `#checkout`; activating it placed the checkout heading approximately 112 CSS pixels from the viewport top, and the bar was hidden at checkout; and
- no first-party Docked console error was observed. PayPal emitted its third-party `ncps_standalone_paylater_ineligible` diagnostic and Apple Pay configuration messages.

The browser pass inspected accessible names and tab/tabpanel state through the tested controls. No separate automated accessibility audit or reduced-motion instrumentation result is claimed.

## Evidence artifacts

- [`local-hero-390.png`](./local-hero-390.png) — corrected 390-pixel hero with the contextual bar hidden and no overlap.
- [`local-lifestyle-390.png`](./local-lifestyle-390.png) — entry into the lifestyle section and the upper portion of the uncropped 3:2 man illustration; disclosure and contextual-bar visibility were verified separately in the viewport sweep.
- [`local-gallery-390.png`](./local-gallery-390.png) — 390-pixel product slideshow after interaction.
- [`local-checkout-390.png`](./local-checkout-390.png) — rendered PayPal checkout at `$649.00 AUD`, with the contextual bar hidden.
- [`local-menu-390.png`](./local-menu-390.png) — open mobile navigation used for the open/`Escape`-close check.
- [`local-hero-1440.png`](./local-hero-1440.png) — desktop hero at 1440 CSS pixels.

These are local candidate captures only. They are not evidence that the candidate has reached `docked.com.au`.

## Deployment and live verification

| Item | Status | Evidence |
| --- | --- | --- |
| Candidate source commit | Pending | Not committed at record time. |
| Working-branch push | Pending | Not pushed at record time. |
| Exact public promotion commit | Pending | Current production remains `dbc68d18e2dd0cfda79ebd9567a854d1c1323bde`. |
| GitHub Pages workflow | Pending | No run exists for this candidate. |
| HTTPS apex and `www` | Pending fresh verification | Historical production evidence is not reused. |
| Live responsive matrix | Pending | Must be repeated on the exact promoted commit; the local seven-width pass is not substituted. |
| Live PayPal product and `$649.00 AUD` display | Pending | No candidate live-widget observation recorded. |
| Real payment | Not run | No real payment is authorised by this QA activity. |

## Limits

- Local rendered results and the six named screenshots are recorded above. No Lighthouse score or automated accessibility result is claimed.
- No first-party Docked console error was observed in the local pass; PayPal's `ncps_standalone_paylater_ineligible` diagnostic and Apple Pay configuration messages mean this is not described as a universally clean console.
- No buyer, card, address or identity data has been entered.
- No payment, seller-side transaction record, confirmation email, PayPal return flow or refund has been tested.
- The current production site's existing HTTP-to-HTTPS enforcement issue is outside this visual candidate and remains separately recorded in the [deployment record](../../../STATIC_PAYPAL_DEPLOYMENT.md).
