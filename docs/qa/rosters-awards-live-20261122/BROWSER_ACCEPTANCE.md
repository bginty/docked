# Owner roster and free-pack award browser acceptance

**Result: 3 passed, 0 failed, 0 skipped, 0 flaky.** The final Chromium run started at `2026-11-22T02:58:27.593Z` and completed in 17.7 seconds. Browser verification found no application defect requiring a source change.

This evidence covers the real Owner components with controlled synthetic HTTP responses. It does not claim a production deployment, live authenticated backend verification, or acceptance on an installed Android app.

## Scenarios exercised

| Journey | Verified behavior | Result |
| --- | --- | --- |
| Owner mixed free-pack award | Mobile review of Premium 1-card and Standard 9-card packs; deliberate confirmation; two-tab contention; recovery after a lost response using the saved request; no second issuance request; history failure handling; Owner identity change isolation | Passed, 5.6 s |
| Owner roster filters and CSV | All filter controls; 201 matching synthetic players; page 2 retains filters and shows players 101–200; page 3 shows player 201; a failed CSV export can be retried; export includes all 201 matching players even when requested from page 2; export omits pagination parameters and carries the expected Owner header; mobile document fits its viewport and the table scrolls internally; commercial operations navigation | Passed, 8.9 s |
| Owner roster state clarity | Legacy players show an unverified current club separately from their saved card club; retired players are excluded from new supply while existing copies remain visible; unconfigured draft players have no activation controls; unsafe source URLs are not linked; literal markup is escaped; all roster interactions are read-only | Passed, 2.2 s |

Both roster journeys assert that no mutation request or browser page error occurs. The award journey uses synthetic customer and award records; it cannot issue real packs or alter credits.

## Runtime and isolation

- Node `22.23.5`, Playwright `1.63.0`, Chrome for Testing `153.0.8010.12` (Chromium build 1243).
- Temporary Vercel Sandbox `sbx_BbyynMLMpZCfUd76PG49poqmhqLk`, Sydney, 2 vCPU and 4 GB memory, nonpersistent.
- Runtime image: `vercel/sandbox/node@sha256:fab118b93f54c391be2cacef5da80d5205c331235e5b070e2545fe902dc563e2`.
- The uploaded bundle contained the component dependency graph, fixtures, configuration and tests. It contained no production credentials.
- Installation used an explicit dependency-download allowlist. Network policy was changed to **deny-all before acceptance ran**; Playwright served all browser HTTP requests through synthetic routes.
- The Sandbox was stopped after the evidence was exported; its final status was `stopped`, reason `requested`.
- The local Chromium attempt was blocked before application execution by the host's singleton socket restriction (`socket() failed: Operation not permitted`). The isolated Sandbox provided the successful browser runtime.

The tests render the production components, query/command schemas and CSV encoder. `next/link` uses a test anchor shim. The roster transport implements synthetic filtering; these browser tests complement, rather than replace, the server/database tests maintained elsewhere in the release evidence.

## Reproduction and checks

Run in a Node 22 environment with the repository dependencies and a working Playwright Chromium installation:

```sh
EXTERNAL_PREVIEW=1 node node_modules/playwright/cli.js test --config=playwright.owner-release.config.ts
```

The focused test files also passed ESLint with zero warnings. The complete repository TypeScript check passed with `--noEmit --incremental false --pretty false` after the browser tests were added.

The first browser attempt exposed a locator issue in the prepared test harness: exact `getByLabel` matching did not identify nested select controls whose labels also contained option text. Tests now use the observed accessible combobox role and exact name. Both browser test files were uploaded again, then the complete three-test suite passed. Application components were not changed.

## Evidence

All paths below are relative to this directory:

- `browser-acceptance/browser-run.log`: final successful command output.
- `browser-acceptance/test-results/owner-release-results.json`: full Playwright results, durations and run configuration.
- `browser-acceptance/package.json` and `browser-acceptance/package-lock.json`: exact dependency set used by the isolated browser runtime.
- `BROWSER_SOURCE_MANIFEST.json`: initial bundle hash, the two changed test files, and final SHA256 hashes for every source file used.
- `browser-acceptance/test-results/owner-release/owner-pack-awards-Owner-re-fcfed-lt-without-a-second-request/mixed-award-review-mobile.png`: reviewed mixed award at mobile width.
- `browser-acceptance/test-results/owner-release/owner-pack-awards-Owner-re-fcfed-lt-without-a-second-request/recovered-award-mobile.png`: recovered award result at mobile width.
- `browser-acceptance/test-results/owner-release/owner-rosters-Owner-roster-ff6f8-he-full-CSV-scope-on-mobile/roster-page-two-mobile.png`: mobile filtered roster.
- `browser-acceptance/test-results/owner-release/owner-rosters-Owner-roster-ff6f8-he-full-CSV-scope-on-mobile/complete-filtered-roster.csv`: synthetic full 201-player export.
- `browser-acceptance/test-results/owner-release/owner-rosters-Owner-roster-95770-ed-players-without-mutation/retired-roster-desktop.png`: excluded retired player with preserved existing copies.

The exported evidence archive was reassembled locally and verified before extraction: **439,785 bytes**, SHA256 **`2242c4aeb413503df676ee73e7271ff14f2eb8de6d4284ec6a560664767fa007`**.

The mixed-award mobile screenshot, filtered-roster mobile screenshot and retired-roster desktop screenshot were visually inspected after export. Labels and controls fit their intended layouts; no clipped text or horizontal document overflow was observed. Runtime assertions separately checked the mobile roster table's internal scrolling and document width.
