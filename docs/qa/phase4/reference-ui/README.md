# Reference-price UI acceptance

Three focused browser cases passed against the local preview, with no application-side provider credentials or sporting records created. The suite is `tests/browser/reference-price.test.ts`.

- Real web aliases preserve the canonical record routes and reject malformed record identifiers.
- Isolated, explicitly labelled DEMO cards distinguish **TAKE 1.94+**, **CURRENT MARKET 2.02**, and the separate locked fair estimate. A missing current reference stays unavailable and suspended; it never falls back to the old bookmaker field. At 320, 390 and 768 CSS pixels, automated WCAG A/AA checks found no violations and no horizontal overflow.
- The isolated composer submits only the canonical market and selection for review. The server's simulated moved benchmark clears confirmation, updates both displayed market prices, and requires explicit reconfirmation. Optional personal price/promotional context is kept separate from the competitive benchmark. No client `odds` or legacy snapshot identifier is sent for the new model. The moved-price review passed automated accessibility and page-error checks.

Screenshots named `DEMO-*` use fictional test fixtures injected only into an isolated browser document. They are **not** historical research, live tips, hosted Auth acceptance or native-device evidence. Neither these fixtures nor intercepted test responses are imported by application routes. The actual hosted market-reference configuration remains NOT_CONFIGURED and UNVALIDATED.

Visual inspection confirmed the threshold/current/fair hierarchy, mobile layout and permanent-record warning. Inspection also caught a stale summary after the price-movement response; the composer now displays the latest matching server review and the test explicitly guards both labels.

Native evidence and limitations are recorded separately in `docs/qa/android/`.
