# Actual hosted preview: read-only public browser acceptance

Run: 3 October 2026, 02:31–02:32 UTC (12:31–12:32 Australia/Sydney). Production build `XeGMIRoSNyjxoNHeeDT3i`, served locally at `http://localhost:3000`, connected to the dedicated Docked Preview project `bckkllmndoxzpzdqrevb` in organisation `ernfnkcbalhyqpsrzdwa`.

**All 3 cases passed in 53.5 seconds.** Eight actual routes were checked at both 390×900 and 1366×900 browser viewports: homepage, edges, results, methodology, the minimum-odds educational article, signup, member dashboard and admin. Every route returned HTTP200, rendered one main heading, decoded its images and remained within the viewport without page-level horizontal overflow. Sixteen axe scans across WCAG2A/AA,2.1AA and2.2AA reported zero violations; browser console errors and uncaught page errors were zero. Automated checks supplement the rendered screenshot inspection and do not establish exhaustive accessibility conformance.

This is actual anonymous application evidence. No page interception, isolated DEMO rendering, fabricated accounts, sporting records or performance data were used. No forms were submitted. Registration remained disabled. No signup, recovery, verification, mail delivery, MFA or other authenticated lifecycle action was attempted. Those remain separate gated acceptance stages.

## Verified service and privacy state

- `/api/status`: HTTP200, `database:true`, odds and results provider status both `NOT_CONFIGURED`; feed, strategy and publication all false. Response is not cached.
- `/api/edges`: HTTP200, no anonymous tips, `private, no-store` response. The rendered edges page says **“Not available in your region”** because no verified country/state exists for an anonymous visitor. It does not claim that a successful scan found no edge.
- `/api/member`: HTTP401 for the anonymous account export request.
- `/api/admin/benefits`: HTTP403 for the anonymous operations request.

The expected401/403 API probes used Playwright's separate API request context. They did not execute page JavaScript, so browser console counts do not require suppressing any actual page errors.

## Screenshot interpretation

Each full-page view has `-390.png` and `-1366.png` variants. Initial homepage viewport captures are also provided for readable navigation and hero inspection.

| File prefix | Actual state captured |
| --- | --- |
| `homepage` | Research preview; historical validation pending and publication paused |
| `edges-unconfigured` | Anonymous region restriction; provider configuration also absent |
| `results-empty` | No accessible publications; metrics display N/A, not invented zero returns |
| `methodology` | Existing unvalidated strategy explanation and limitations |
| `article-educational-draft` | Minimum-odds article explicitly labelled educational draft with fictional worked examples |
| `signup-unsubmitted` | Registration disabled; optional digest, education, Edge alerts and analytics unchecked |
| `member-anonymous-gate` | Sign in to a verified account; no private member data displayed |
| `admin-anonymous-gate` | Verified staff role and MFA required; no operations data displayed |

Rendered desktop/mobile samples were inspected for readable type, navigation, image crops, layout clipping and truthful empty/access states. No material visual defect was found. The results table remains inside its existing scrollable region on mobile rather than overflowing the page.

Machine-readable receipts: `public-smoke-results.json`, `public-api-status.json`, `public-routes-390.json`, `public-routes-1366.json`. The report contains static route/status information only; screenshots contain no credentials, sessions, OTPs or actual member data. Earlier Phase3 evidence was not overwritten.

## Reproduce the public checks

The provisioning operator must first confirm that the running localhost application is bound to the dedicated Docked Preview project. This command authorises only this suite's read-only public checks; it does not authorise the separate genuine-account suite.

```powershell
$env:DOCKED_HOSTED_PUBLIC='bckkllmndoxzpzdqrevb'
npx playwright test -c tests/hosted/public-smoke.config.ts
```
