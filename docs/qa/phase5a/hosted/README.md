# Actual Preview staff acceptance

**PASS: 308 assertions**, completed 2026-10-03 23:58:58 UTC against the verified Docked Preview deployment `dpl_2Km6vCTVhK3iwavf2E9DRmgjWpLD`, source `2e9041236b6e26043277e8cf103d1ebe49fe55c2`. [Machine-readable receipt](acceptance.json).

The workflow used the disposable operator's genuine application login and existing TOTP factor. It verified secure session cookies, denied AAL1 staff access, AAL2 staff access and private caching. Anonymous internal endpoints denied requests without tokens. All three ordinary-member market-data windows remained region-denied with empty results; community quote options remained `NOT_CONFIGURED` and empty because no reference source cohort is approved.

The actual Data Health view showed Preview-only rights, genuine retained fixtures, nine request attempts/eight successful HTTP responses, the preserved `TRIAL_REQUEST_FAILED`, unknown total reported charges, and historical access `NOT_INCLUDED`. All fifteen unconfigured reference diagnostics retained **Unknown** for the eight unmeasured source/price fields. The scanner remained paused and showed the last recorded data-only observation with `MODEL_PROBABILITY_UNAVAILABLE`; it did not claim continuously fresh data or a validated probability model.

Both screens at **412 and 1366 pixels** passed the specified WCAG axe scan and document-overflow checks. Browser page errors and console errors were both **zero**. The [rendered secret audit](client-secret-audit.json) scanned four private rendered HTML documents and fourteen client scripts: **18 files / 1,368,666 bytes**, with zero findings or errors. Private originals remain under `private-data/phase5a/hosted-rendered` for the independent audit. The browser closed; the operator was deliberately left intact for the parent workflow's final audit, revocation and erasure.

## Screenshots

All four original captures were visually inspected. These show real staff data and actual access controls; no route interception, synthetic provider data or forged session was used.

| Screen              | Original full-page capture     | Inspectable exact-pixel crop                           |
| ------------------- | ------------------------------ | ------------------------------------------------------ |
| Data Health mobile  | [412px](data-health-412.png)   | [412 × 2800 top metrics](data-health-412-detail.png)   |
| Data Health desktop | [1366px](data-health-1366.png) | [1366 × 1600 top metrics](data-health-1366-detail.png) |
| Scanner mobile      | [412px](scanner-412.png)       | [412 × 915 initial viewport](scanner-412-detail.png)   |
| Scanner desktop     | [1366px](scanner-1366.png)     | [1366 × 900 initial viewport](scanner-1366-detail.png) |

The four crops use the original pixels from rectangle `(0,0,width,height)` without recolouring, resizing or adding content. The full-page mobile scanner screenshot retains the browser's fixed bottom navigation at its initial viewport position; the compact crop shows the actual initial viewport.

## Preserved harness failures

- [First attempt](failure-2026-10-03T23-53-40.045Z.json): nineteen assertions passed before an incorrect expectation of `RESTRICTED` community quote status. The implementation explicitly checks absent approved reference cohorts first and returns `NOT_CONFIGURED`. The corrected assertion requires that exact status and an empty options array; the separate jurisdiction-denial assertions were retained.
- [Second attempt](failure-2026-10-03T23-55-51.922Z.json): twenty-eight assertions passed before the new reference-detail inspection. An isolated Chromium experiment established that `innerText` is empty inside collapsed `details`, while `textContent` retains the actual diagnostic value. Only this read mechanism changed; every exact unknown-value assertion remains. One actual diagnostic is expanded for visual inspection.

No application gate or backend value changed to satisfy these tests. Scoped lint and whole-project type checking passed after the harness corrections.

## Limits and follow-up

- The final poll table renders a long sports-catalogue diagnostic JSON entry in full. This creates a lengthy, sparse mobile scroll. Primary metrics remain readable and horizontal overflow stays contained, but a future collapsed or bounded diagnostic viewer would improve admin usability. The raw diagnostic remains intact; this is a presentation limitation, not evidence of a data or access-control failure.
- Staff access to retained fixtures does not grant member display rights or community Edge composition. The tested ordinary-region controls remain denied.
- The browser workflow made **zero provider requests**, submitted **zero trial permits**, and sent no emails. Actual capped trial requests are evidenced separately by the parent operator receipts.
- Historical data, approved probability modelling, forward-paper validation and live Edge publication are not established by these checks. Browser widths are not physical Android device acceptance.
