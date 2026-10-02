# Sports visual milestone: local preview evidence

This directory records the existing interface before the visual changes and the same local preview after them. It is design and software QA evidence, not strategy validation, customer activity or production performance data.

## Capture conditions

Run `node docs/qa/visual-sports/capture.mjs before` or `after` against a built standalone preview already running on `http://localhost:3000`. The command does not build or deploy the application.

Homepage performance uses headless Chromium, three fresh browser contexts at each viewport, a warmed local server, device scale factor 1, and no CPU or network throttling. The two viewports are 1440 × 1000 and 390 × 1000 CSS pixels. Each observation ends 1200 milliseconds after network idle. Reported medians are computed independently for LCP, CLS, DOMContentLoaded and transferred bytes. The JSON retains every run, browser version, build identifier and capture time.

Transferred bytes are NavigationTiming plus ResourceTiming `transferSize`, including response headers where exposed. A fresh context has no preceding browser cache; the local server and image optimizer may have warmed caches. Viewport emulation does not reproduce mobile hardware or networks. These measurements are repeatable local lab comparisons, not field Core Web Vitals or a production forecast.

Screenshot capture is separate from performance capture. It loads below-fold lazy images before taking a full-page screenshot. The performance observation does not scroll.

## Before

Captured from the existing build `dWQlLzjgJo-X_oTd0Nrcn` before rebuilding any visual source changes. Raw evidence is in `before/performance.json`.

| Viewport | Median LCP | Median CLS | Median DOMContentLoaded | Median transferred bytes |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 1000 | 284 ms | 0 | 74.2 ms | 260,705 |
| 390 × 1000 | 248 ms | 0 | 65.1 ms | 256,858 |

Before screenshots cover homepage, edges, results, an article, sports index and the locked member dashboard at both widths.

## Validation scope

`tests/browser/visual-sports.test.ts` checks homepage, edges, results, reading room, article, sports index, football, basketball, tennis and locked member/admin views at 390, 430, 768, 1366 and 1920 pixels. It checks loaded decorative photos, overflow, unchanged unavailable/restricted labels, automated WCAG 2.2 AA rules, console errors and page errors. A separate smoke test covers all ten sport routes, image decoding, canonical URLs, titles, explicit coverage labels and the legacy NBA redirect. Per-width evidence and screenshots go in `after/`.

The isolated no-edge fixtures cover a genuine no-qualifying-edge state, a region restriction and a provider outage. They render the real component without inserting records into the database or adding an application route. Fictional fixture screenshots are explicitly named. Authenticated member/admin controls still require a verified account and configured preview authentication; no authentication is fabricated to capture them.

The photo-delivery regression deliberately cancels one initial atmospheric-photo request and one motorsport-photo request in the browser, navigates away, and revisits without interception. It requires successful decoding of the real local files on return. Normal page visits also require local responsive WebP sources and make no runtime image-optimizer request. This cancellation simulation changes no application data; expected cancelled requests are separate from normal browsing console checks.

Automated accessibility tests do not constitute a complete human accessibility audit.

## Issues found during verification

- The focused skip link overlapped the home/brand link at a narrow viewport, producing a WCAG 2.2 target-size failure. It now enters normal document flow while focused. The keyboard test asserts that its bottom edge does not overlap the brand at 1440, 390 and 320 pixels, in addition to the accessibility scan.
- Small section numbers on sport detail pages initially had 4.22:1 contrast. Their foreground changed from `#667972` to `#52685f`. A source-equivalent diagnostic checked all ten sport routes at 390 pixels and football, basketball and tennis at all five requested widths. Final acceptance subsequently passed against the rebuilt application without style injection.
- The runtime image optimizer stalled format-specific WebP responses: first the 640-pixel motorsport photo, then the 640-pixel atmospheric football photo on a later run. Both source files decoded correctly. A restart temporarily recovered the first response but did not resolve the recurring issue. The atmospheric image blocked its article navigation for about 44.75 seconds; the preceding journey took about 17 seconds. This was an image-delivery defect, not an exhausted multi-page test budget. The repair replaces runtime conversion with prebuilt responsive WebP files selected by a registered local-asset loader. Strict network-idle and image-decoding checks remain, with a cancellation/revisit regression and assertions that these photos never call the runtime optimizer.

## After

Final build: `clk6RldtqJMhZT-lWqwXa`. All **16 Playwright cases passed** in 260.5 seconds, with no skipped or flaky cases. `after/test-summary.json` preserves the result. This includes 55 route/viewport combinations across all five requested widths, all ten sport routes, the NBA redirect, and the cancellation/revisit regression. Normal browsing produced no console or page errors, automated accessibility violations or page overflow. The responsive checks recorded no runtime image-optimizer requests. The final run uses the built source with no injected styles and retains the original image-readiness and timeout checks.

Raw measurements and all three runs are in `after/performance.json`, using the same browser version and observation conditions as the baseline.

| Viewport | Median LCP, before → after | Median CLS, before → after | Median DOMContentLoaded, before → after | Median transferred bytes, before → after |
| --- | ---: | ---: | ---: | ---: |
| 1440 × 1000 | 284 → 444 ms | 0 → 0 | 74.2 → 62.9 ms | 260,705 → 925,255 |
| 390 × 1000 | 248 → 276 ms | 0 → 0 | 65.1 → 59.7 ms | 256,858 → 450,988 |

The photography increases initial transfer: about 665 kB on desktop and 194 kB at the narrow viewport in this observation. The LCP element changes from the heading to the hero photo. These local numbers document that trade-off; they are not a claim about field performance or mobile-device speeds. All tested layouts retain zero measured layout shift in the homepage observations.

Fresh full-page screenshots use `homepage`, `edges`, `results`, `learn`, `article`, `sports`, `sport-football`, `sport-basketball`, `sport-tennis`, `member-locked` and `admin-locked` prefixes in `after/`, with the viewport width suffix. Readable homepage viewport crops use `homepage-viewport-{390,430,1440}.png`. The `review-*` images show article, results, edges and sport headers at 390 and 1366 pixels; `review-manifest.json` records their final build. Fictional state and edge evidence is explicitly named `fixture-*` or `regression-*`.

Manual inspection of the final rendered screenshots covered football, basketball, tennis, edges, results, the article, the isolated no-edge state and the homepage. The reviewed narrow and desktop crops retain readable headings and disclosures, visible photographic subjects and no clipped or overlapping content. Member and admin screenshots intentionally show their genuine signed-out gates.

Earlier source-equivalent contrast diagnostics live separately in `preflight/` and are labelled as such. The `before/` directory and the earlier Phase 2 screenshot directories remain preserved.
