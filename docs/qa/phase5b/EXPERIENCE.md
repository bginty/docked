# Phase 5B browser and visual acceptance

All **84 distinct browser cases** have passing evidence against the unchanged isolated production build `UoeIerr0YZmdU1OmJylsP`. This was not a single uninterrupted 84/84 green run.

| Run | Actual result | Evidence |
| --- | --- | --- |
| Complete suite, one worker | 78 passed, 6 failed; 959.344 seconds; no skipped/flaky cases | [Original full receipt](browser-initial-full.json) |
| Six corrected contract cases | Five sports-width cases passed; public-page case reached a second obsolete metric assertion; 256.156 seconds | [Intermediate receipt](browser-corrected-contracts.json) |
| Exact public-page case after final duplicate correction | 1 passed; 20.987 seconds; no skipped/flaky cases | [Final case receipt](browser-experience-final.json) |

The six original failures used retired Results presentation contracts: one old table-region name and five expectations for “Settled publications / N/A”. The public-page case contained a second copy of that metric assertion. Tests now target “Complete official publication ledger” and “Settled / Unavailable”, preserving focus, horizontal keyboard scrolling, no-zero/unknown handling, console, image, overflow and accessibility checks. No production change, timeout relaxation or safety assertion removal was used. [Original failure contexts/screenshots](browser-initial-failure/) and [intermediate failure evidence](browser-intermediate-failure/) remain available; traces stay in ignored local storage. The initial CLI attempt also stopped before collecting tests because PowerShell split an unquoted reporter comma; its private invocation log is retained.

The run used the coordinating agent's isolated local server: database/Auth/provider configuration was blank, runtime sending/polling/publication disabled, and server-side external fetches blocked. No external-fetch guard events were recorded. Tests distinguished actual anonymous routes from clearly labelled synthetic component fixtures; they did not insert users, odds, tips, sporting outcomes, engagement or returns into a real database. Real hosted acceptance is recorded separately. The source `.env.local` was not edited.

Coverage includes the official forward-record empty/restricted/populated states, complete losses/voids/disputes/corrections, global start-date preservation, model-unavailable cards, new model-admin anonymous/CSRF gates, community controls, all five tabs, safe-area/keyboard clearance, consent, revoked-content handling, scanner/revalidation, PWA/private-cache boundaries, production account projections, article metadata, static sports image decoding and public navigation. Responsive widths span 320–1920 pixels across the suite. Every passing case's configured axe, console and overflow assertions passed. This does not establish physical-device or real account/DB acceptance.

## Supplemental public review

The actual local `/results`, `/research` and `/methodology` pages were captured at **390 and 1366 pixels**, with full-page and initial-viewport images, and visually inspected. All six views returned 200, had one main heading, decoded their images and had zero overflow, console/page errors, external requests or tagged WCAG 2/2.1/2.2 A/AA violations. [The complete receipt](public-review/receipt.json) preserves the findings; [screenshots](public-review/) show the truthful disconnected state. Actual Results displays unavailable metrics because the local database is absent; the fictional ready-empty fixture separately verifies the exact “The record has not started yet” state.

The broader default axe scan reports **one `region` best-practice rule in each of the six views**, with **two repeated targets** per view: `.topline` and `.preview-banner`, outside page landmarks. That is six rule occurrences / twelve target occurrences, all the same existing global-chrome advisory, moderate impact. These are explicitly retained in the receipt and [initial diagnostic](browser-initial-failure/supplemental-landmark-advisory.txt); this is not a claim of zero findings across every axe rule. Global chrome was not changed in this phase.

Results phone/desktop, all five mobile tab fixtures, compact discovery, Research phone/desktop, Methodology phone/desktop and packaged native offline-shell captures were reviewed with the image viewer. No clipping, unreadable metric wrapping or material contrast problem was observed in those captures.

## Native delivery

[V6 APK and exact audit evidence](android/README.md) are complete. The actual v5 binary remains unchanged and was compared for upgrade compatibility. V6 physical Samsung S24 acceptance remains **unverified**; the user's confirmation applies to v5. The packaged host receipt describes the initial verified Phase 5A deployment, while the stable HTTPS alias delivers the later web application independently.
