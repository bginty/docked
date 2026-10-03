# Phase 5A diagnostic presentation

The staff Data Health view now separates reviewed rights from request authority, manual fetch history, reserved and provider-reported credits, measured data quality, pricing/availability reference coverage and historical account access. Unknown values remain unknown. A known zero is rendered only when the backend supplies it. Reference values are withheld when their evaluation is unavailable.

Canonical trial fixtures are a bounded staff-only evidence view. They do not grant member market-display rights or enable community composition. The public watchlist still distinguishes market data from a Docked Edge and labels missing values “Reference unavailable.” Scanner diagnostics explicitly describe the last observation and an unavailable model, without presenting a current feed or validated probability.

Focused verification:

- Five platform presentation regressions passed, including missing-versus-zero, budget reservation versus reported charge, unavailable reference price hiding, data-only/model-unavailable distinction and safe first-party review links.
- [Final focused browser receipt](data-health-browser.json): 3/3 passed in 47.007 seconds at 360, 412 and 1366 pixels. Each case covers pending rights, approved/no requests, measured diagnostics and unavailable ledger states. No axe violations, browser errors or horizontal document overflow; complete poll evidence remains keyboard-scrollable.
- Twelve labelled synthetic screenshots are in [data-health](data-health/). Mobile long diagnostics and desktop approved/no-request captures were visually inspected. These are isolated layout evidence, not actual provider records or real-authentication acceptance.
- A first successful run preceded the staff-fixture/model additions. The subsequent run caught duplicate rendering in the isolated fixture; [its failure receipt](data-health-browser-fixture-duplicate.json) is preserved. Removing that accidental duplicate restored the unchanged assertions. No application gate or test assertion was relaxed.
- A final wording clarification after these captures identifies the scanner status as the **last** observation, rather than current freshness. The integrated browser run will recapture final source.

The local server used for this focused suite served static public assets only; it ran no application, Auth, database or provider code and is now stopped.

The opt-in `scripts/hosted-preview/phase5a-browser.ts` workflow is prepared separately. It requires the exact canonical Preview origin, explicit project confirmation, and the private disposable-operator journal. It uses genuine login and existing MFA, tests denied ordinary-region access, captures actual staff evidence and scans rendered HTML/client scripts against known secrets. It submits no trial permit. It has not been executed at this preparation checkpoint; hosted receipts, when produced, are separate evidence.
