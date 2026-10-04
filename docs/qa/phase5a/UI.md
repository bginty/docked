# Phase 5A diagnostic presentation

The staff Data Health view now separates reviewed rights from request authority, manual fetch history, reserved and provider-reported credits, measured data quality, pricing/availability reference coverage and historical account access. Unknown values remain unknown. A known zero is rendered only when the backend supplies it. Reference values are withheld when their evaluation is unavailable.

Canonical trial fixtures are a bounded staff-only evidence view. They do not grant member market-display rights or enable community composition. The public watchlist still distinguishes market data from a Docked Edge and labels missing values “Reference unavailable.” Scanner diagnostics explicitly describe the last observation and an unavailable model, without presenting a current feed or validated probability.

Focused verification:

- Five platform presentation regressions passed, including missing-versus-zero, budget reservation versus reported charge, unavailable reference price hiding, data-only/model-unavailable distinction and safe first-party review links.
- [Final focused browser receipt](data-health-browser.json): 3/3 passed in 47.007 seconds at 360, 412 and 1366 pixels. Each case covers pending rights, approved/no requests, measured diagnostics and unavailable ledger states. No axe violations, browser errors or horizontal document overflow; complete poll evidence remains keyboard-scrollable.
- Twelve labelled synthetic screenshots are in [data-health](data-health/). Mobile long diagnostics and desktop approved/no-request captures were visually inspected. These are isolated layout evidence, not actual provider records or real-authentication acceptance.
- A first successful run preceded the staff-fixture/model additions. The subsequent run caught duplicate rendering in the isolated fixture; [its failure receipt](data-health-browser-fixture-duplicate.json) is preserved. Removing that accidental duplicate restored the unchanged assertions. No application gate or test assertion was relaxed.
- A final wording clarification identifies the scanner status as the **last** observation, rather than current freshness. The integrated run below refreshed all twelve captures with that wording.

The local server used for this focused suite served static public assets only; it ran no application, Auth, database or provider code and is now stopped.

The opt-in `scripts/hosted-preview/phase5a-browser.ts` workflow is prepared separately. It requires the exact canonical Preview origin, explicit project confirmation, and the private disposable-operator journal. It uses genuine login and existing MFA, tests denied ordinary-region access, captures actual staff evidence and scans rendered HTML/client scripts against known secrets. It submits no trial permit. It has not been executed at this preparation checkpoint; hosted receipts, when produced, are separate evidence.

## Integrated isolated browser regression

[Full browser receipt](full-browser.json): **82/82 passed**, with zero failures, skipped cases or flaky retries, in **1,555.148 seconds**. The single-worker run started at 2026-10-03 23:17:51 UTC against source `51be704` and production build `4onaGwnJq8O-fqgVwC1cb`. This validates that source's UI and isolated fixtures; it does not validate subsequent hosted ingestion repairs or establish real provider/authentication acceptance.

The run refreshed **367 screenshots** in this evidence directory, including twelve Data Health states. The measured mobile and approved/no-request desktop Data Health captures were visually reviewed. The relevant route/fixture tests passed their axe, console-error, overflow, keyboard, safe-area, image-decoding and interaction assertions. Timestamp hydration passed with UTC server markup and both Sydney and New York client timezones.

Isolation was verified before execution: database/feed/strategy/publication were off, providers were `NOT_CONFIGURED`, and account endpoints failed closed. Build-only credential canaries were absent from **50 browser assets**; runtime credentials were blank. A loopback-only guard recorded **zero external application `fetch` attempts**. This is an application-fetch observation, not a claim about unrelated browser or operating-system background traffic. `.env.local` was not edited. See [isolation receipt](isolation.json) and [consolidated summary](full-browser-summary.json).

The isolated app server was stopped after completion, with loopback connection refusal verified. The build is retained for independent inspection. Scoped lint and whole-project type checking also passed after the opt-in hosted script gained explicit checks for preserved failure history, unknown reported charges and unavailable historical entitlement. That script remains unexecuted at this checkpoint.

A subsequent backend diagnostic repair preserves unknown source metrics when reference cohorts are not configured. Final source `2e9041236b6e26043277e8cf103d1ebe49fe55c2` compiled successfully as build `jNuceFbCc6zlPkZ0ZsBLx`, and the separate [final isolated build receipt](final-isolated-build.json) records another clean 50-asset credential-canary check. The 82-case browser receipt above retains its original build attribution; it is not relabelled as a rerun of this later build. Hosted acceptance will additionally require all unmeasured reference metrics to remain **Unknown** in the actual staff UI.

## Subsequent actual hosted acceptance

[Hosted acceptance](hosted/README.md) subsequently passed **308 assertions** against the final verified Preview deployment, with genuine login/MFA, four real staff screenshots, zero axe/console/page/overflow failures, and a clean eighteen-file rendered/client secret scan. It confirms that all unmeasured reference fields remain Unknown. The two harness-only failed attempts and their corrections are preserved and explained in that report. No provider permit or request was submitted by the browser workflow. The report also records the long expanded sports-catalogue poll entry as an admin usability limitation and keeps operator cleanup assigned to the parent workflow.
