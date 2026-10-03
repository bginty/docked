# Docked Edge Signal implementation and delivery

Continued from clean `d10e974` on `codex/docked-value-platform`. Implementation commit `5ee5c56b769abb875ee2fe6a00c0519288777841` applies the approved **BUILT FOR AN EDGE** direction to the existing website and Android application. Authentication, APIs, data access, consent, calculations and workflows retain their existing behaviour. No production, DNS, Oura or email action was performed.

The original 35-file Desktop pack is preserved unchanged in the existing local archive `source-assets/brand/docked_production_brand_pack/` (Git-ignored). Runtime copies are versioned in `public/brand/`; supplied instructions and token JSON are versioned in `src/brand/`. [Source integrity](source-integrity.json) confirms all archive/public copies match their originals. Artwork is not redrawn, recoloured, stretched, rotated or given new shadows. Native size exports preserve its proportions and add only the platform's required safe-area canvas.

The plan was to inventory the pack and existing brand surfaces, preserve the originals, centralise the theme, replace brand surfaces, then verify rendering and existing behaviour. [The detailed inventory and QA plan](PLAN.md) records those boundaries.

## Exact supplied assets used

| Source path within the pack | Active surfaces |
| --- | --- |
| `logos/docked-primary.png` | Public header on light backgrounds |
| `logos/docked-primary-on-dark.png` | Footer, member sidebar, community share-image header, native/PWA offline pages and older Android splash |
| `logos/docked-mark.png` | Compact app header, authentication, official Docked profile/avatars, Android adaptive foreground and Android 12+ splash |
| `logos/docked-mark.svg` | Next `/icon.svg` and legacy `/icons/docked.svg`, unchanged raster-in-SVG container |
| `icons/favicon.ico` | Exact file served at `/favicon.ico` |
| `icons/docked-mark-32.png` | Explicit browser icon metadata |
| `icons/docked-app-icon-180.png` | Apple touch metadata and `/apple-icon.png` |
| `icons/docked-app-icon-192.png`, `icons/docked-app-icon-512.png` | Existing ordinary PWA icon URLs, unchanged bytes |
| `icons/docked-app-icon-1024.png` | Android legacy launcher master/density exports and contained maskable PWA derivative |
| `social/docked-hero-built-for-an-edge.png` | Exact `/opengraph-image` response; same PNG embedded in the legacy `/social-card.svg` |
| `brand-tokens.json` | Shared TypeScript/native values and matching central CSS primitives |

Other supplied monochrome, icon-size and SVG alternatives are retained but are not claimed as active UI surfaces. The approved concept board is in the local archive. [Native asset mapping and verification](native/NATIVE_BRANDING.md) distinguishes exact copies from proportional platform exports.

`src/app/brand-theme.css` centralises navy `#0B1F3B`, blue `#2563FF`, mint `#00E6B8`, cool gray `#CBD5E1` and white `#FFFFFF`, plus readable semantic text, surface, focus and status colours. All existing stylesheet colours resolve through these tokens. `src/brand/brand.ts` provides shared metadata/native/image-renderer values; `BrandLogo` selects supplied light/dark artwork with accessible labels. Functional navigation icons and ordinary member avatars remain unchanged. Charts retain their calculations.

Sora is self-hosted from the official [Google Fonts Sora directory](https://github.com/google/fonts/tree/main/ofl/sora), with its OFL licence in `public/brand/fonts/`. No runtime request goes to Google. Offline pages use the available system fallback; community share images retain the renderer's sans-serif font. Sports photography is subdued and the sports gallery follows the opportunity board. The content theme remains deliberately light under either OS colour preference.

There is no native iOS project. Apple/PWA icons are updated; no native iOS binary or launch screen is claimed.

## Validation and preview

- TypeScript, lint, production build and **188/188 platform tests** passed (the final full platform run includes APK-preservation regression coverage).
- **47 distinct local browser cases** passed, including focused reruns described below: 72 public route states, 24 labelled member-style fixtures and existing regression coverage.
- **12 hosted route/viewport cases** passed, with no browser errors, broken images, overflow or axe violations. [Hosted report](hosted/candidate-2026-10-03T08-17-23-401Z/README.md) retains incomplete contrast checks and distinguishes public/gated screens from real authenticated acceptance.
- Source export integrity and the Vercel dry-run agree on **323 files / 11,024,538 bytes**, including SHA-1 and SHA-256 checks. [Export receipt](deployment-export-audit.json).
- Credential scans passed for all 323 exported files and 153 public/build files, with zero findings. [Source scan](deployment-source-secret-audit.json), [public scan](public-secret-audit.json).
- Next traces include the supplied server-rendered wordmark and social banner. Local and hosted `/opengraph-image` responses match the supplied PNG; anonymous member/share access remains denied.
- Native resource compilation, isolated offline accessibility and the PowerShell archive-guard regression passed. The final APK's **988 entries** passed the complete credential scan; inspection/debugging and cleartext are disabled. [Native receipts](native/NATIVE_BRANDING.md).

The stable [Docked Preview](https://docked-preview-s24-briant-ginty.vercel.app) now points to **READY Preview** deployment `dpl_98W8eekf5UHSkD1oNWNe39wRVUNb`, source `5ee5c56`. [Hosting audit](hosting-audit.json) confirms the exact existing project, 27 Preview variables, zero production variables/deployments and healthy fail-closed service state. Older deployment receipts are preserved.

The build initially rejected the supplied ICO through Next's image processor (`PNG is not in RGBA format`). Serving the same bytes directly from `public/favicon.ico` fixed this without editing the artwork. Offline tests and native copy guards now accept only the exact supplied embedded PNG, retaining hashed CSP, network restrictions and complete credential scans. Random PNG base64 is excluded only from human-copy matching after its identity is verified.

The exact path inventory is in [changed-files.txt](changed-files.txt). Server/core/database schemas and dependency manifests were not changed. This work does not establish strategy profitability or live-launch readiness. Physical-device acceptance remains separate from responsive browser and APK artifact checks.

## Android delivery and preservation incident

Installable deliverable: `artifacts/android/Docked-Preview-S24-v3-Edge-Signal.apk`, **9,262,110 bytes**, SHA-256 `d34678b205e7a4ad21589345d642cde64bb49c865ce076df66c929cc70f97df0`. Package `au.com.docked.app.preview`, version code **3**, version name `1.2-preview`. It retains the preview signing certificate and opens the existing stable HTTPS preview. The APK is Git-ignored; source, delivery metadata and verification receipts are versioned. A physical Samsung S24 install/lifecycle check remains pending.

Gradle cleared its output directory during this build, removing the prior final v2 APK despite its separate filename. That was a preservation mistake. Searches did not recover the exact binary. The stopped emulator contains a different earlier preflight build, so it cannot restore the lost final hash; it was not restarted. Previous source and historical audit records are intact. Current v3 checks compare the actual preserved v1 binary and separately compare the historical v2 receipt; **a fresh v2 binary comparison is unavailable**. The report does not claim otherwise.

The build runner now archives every existing delivery/debug/preview APK outside Gradle under its SHA-256 before building and verifies each copy, refusing to proceed on failure. Successful builds write the durable delivery path and archive the new output. A temporary-directory regression verifies survival after simulated Gradle cleanup, multiple versions, idempotency and refusal of a corrupt archive. No new Gradle run was needed to prove this filesystem fix.

## Browser QA evidence

All **47 distinct browser cases passed** on the isolated optimized local build `jDLu7yngsT1Rlq2dGC6-S`, corresponding to web implementation commit `5ee5c56`. This combines the original full run with seven focused corrective reruns. It does not describe the initial run as clean.

## Results and repairs

| Run | Passed | Failed | Skipped | Flaky |
| --- | ---: | ---: | ---: | ---: |
| Original complete suite | 40 | 7 | 0 | 0 |
| Corrected isolated member fixture matrix | 6 | 0 | 0 | 0 |
| Corrected header geometry journey | 1 | 0 | 0 | 0 |
| Final distinct-case coverage | 47 | 0 | 0 | 0 |

The original six fixture failures were caused by the new test harness returning HTTP 400 to automatic read-only composer/media requests. The harness now provides explicitly empty, fictional provider/media GET responses and continues rejecting every mutation. Console errors remain test failures. The seventh failure was a strict locator matching both accessible header and footer home links; the header geometry assertion now scopes the locator to the header. No application behavior was changed for these repairs.

`browser-first-run.json` preserves the original failures. `brand-fixture-rerun.json` and `brand-header-rerun.json` preserve the corrective runs. `browser-results.json` records all 47 distinct case names and the combined outcome. Scoped ESLint and project type checking also passed.

## Coverage

The new brand matrix checks 12 public routes at 320, 390, 768 and 1440 pixels, plus dark OS preferences at 390 and 1440 pixels: 72 public route states. It checks 24 isolated member-style views across the same matrix. These include Home, compose, profile and notifications, with explicit fictional fixture labels and no authenticated session or database operation.

Checks cover loaded Sora fonts, supplied artwork hashes and dimensions, logo proportions and absence of decorative effects, horizontal overflow, relevant computed contrast, Axe WCAG A/AA checks, browser console errors and failed brand/font requests. The existing journey, community, reference-price, timestamp hydration, sport-image and native offline browser regressions also passed. Deliberate light controls under a dark OS preference remain unchanged; no dark-theme feature is claimed.

The favicon is served directly with its supplied bytes. Ordinary PWA icons are supplied-byte aliases. The maskable icon is an approved-source resize contained within the safe area, verified against its source pixels rather than incorrectly requiring an identical binary. The offline page embeds the exact supplied on-dark PNG. Details and source fingerprints are in `PLAN.md` and `approved-source-assets.json`.

## Readable visual evidence

- `browser/homepage-320-viewport.png`
- `browser/homepage-1440-light-viewport.png`
- `browser/DEMO-home-390-light-viewport.png`
- `browser/DEMO-home-1440-light-viewport.png`
- `browser/DEMO-profile-390-light-viewport.png`
- `browser/DEMO-profile-1440-light-viewport.png`
- `browser/results-390-footer-viewport.png`

`MANUAL_REVIEW.md` records the comparison with the supplied brand board. A blank-looking footer logo in an earlier full-page results capture was a capture/decode artifact: scrolling the actual footer into view and awaiting `HTMLImageElement.decode()` confirmed the supplied 1600×380 on-dark artwork renders correctly. Brand screenshot readiness now explicitly awaits decoding. No application repair was necessary.

## Safety and limits

The server had database, Supabase, provider and mail credentials blank, with registration, publication, forward paper, delivery and commercial flags disabled. Existing milestone screenshots were preserved under their original locations; this run writes to this dedicated evidence directory. No owner/tester credentials, new accounts, hosted database changes, external emails, live sporting records or production deployment were involved. These visual fixtures are not evidence of real performance, authentication acceptance or strategy validation.
