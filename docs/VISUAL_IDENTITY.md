# Visual sports identity milestone

3 October 2026 · `codex/docked-value-platform` · continued from clean Phase 2 commit `8fa346c`.

## Delivered experience

The homepage now opens with a cinematic night football stadium, restrained navy overlays and the approved positioning: “Only when the price offers value.” Sporting atmosphere leads; the existing evidence and eligibility controls remain visible. Navigation includes Edges, Results, Sports, Research, Learn and Methodology, with Sign in and Join free accessible on mobile.

Explore Sports uses ten photographic category cards. Football and basketball are labelled **Research coverage**, derived from the installed strategy's competition configuration. Tennis, American football, horse racing, cricket, baseball, ice hockey, motorsport and Australian rules are **Coming soon**. The presentation helper has no path that promotes an unvalidated strategy to LIVE.

The reusable sport page includes a photographic header, explicit coverage, sport-specific contract and settlement explanations, configured competitions, eligible current publications, recent outcomes, data health and educational links. Unsupported sports explain the evidence needed for future coverage. They do not query or manufacture opportunities. Ten canonical pages are available under `/sports`; the former `/sports/nba` address permanently redirects to `/sports/basketball`.

Edges and Results have restrained photographic headings. Edge cards retain their odds, minimum price, EV, status and freshness hierarchy, with a small sport pictogram. Results remain on clean surfaces with the existing complete ledger and filters. The atmospheric no-edge component retains distinct no-edge, unavailable and restricted states. Eight educational articles now have consistently rendered sports feature images. Member preferences and admin review headings receive decorative icons only.

## Assets and rendering

- Twelve local master WebP exports: eight Unsplash photographs, three original generated scenes and one smaller football hero derivative. The masters total 1,574,052 bytes; no individual file exceeds 210,256 bytes. The homepage hero is 144,226 bytes at its native 1643 × 957 resolution. Forty-nine smaller responsive derivatives add 1,563,436 bytes to the repository; each is 4,940–111,734 bytes. A browser downloads its selected variants, not this entire set.
- Exact sources, licence basis, dates, visual review, generation prompts and attribution are in [IMAGE_RIGHTS.md](IMAGE_RIGHTS.md). The [asset manifest](../public/images/sports/manifest.json) records hashes, dimensions, alt text, focal positions and tiny blur previews. All twelve delivered hashes were verified.
- `SportImage` uses Next Image with a registered local loader, responsive sizes, reserved image areas, reviewed object positions and blur placeholders. Responsive WebP derivatives are generated ahead of time by `npm run images:build`; requests do not use the runtime `/_next/image` optimizer. Above-fold lead images can preload; category and editorial cards remain lazy. No stock-photo host is contacted by a visitor.
- Ten original monochrome SVG pictograms cover the same sports. No emoji, team logos or external icon dependency was added.
- Decorative photography uses empty alt text beside its existing text context. The component supports descriptive manifest alt text when an image is informative. Essential status, prices and explanations remain selectable text. Reduced-motion preferences disable decorative photo transitions.

## Main implementation files

| Area                       | Files                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Homepage and navigation    | `src/app/page.tsx`, `src/app/layout.tsx`                                                                                                                     |
| Shared images and icons    | `src/components/sport-image.tsx`, `static-sport-image.tsx`, `article-image.tsx`, `sport-icon.tsx`, `explore-sports.tsx`                                      |
| Responsive image delivery  | `scripts/build-sport-images.mjs`, `src/core/sport-image-loader.ts`, `src/content/sport-image-sizes.json`, `public/images/sports/responsive/**`               |
| Visual styles              | `src/app/sports-visuals.css`, `sports-experience.css`, `sports/sport-page.css`                                                                               |
| Sport content and coverage | `src/content/sports.ts`, `sport-visuals.ts`, `src/core/sport-coverage.ts`                                                                                    |
| Sport and league pages     | `src/app/sports/**`, `src/app/leagues/[league]/page.tsx`, `src/app/sitemap.ts`                                                                               |
| Secondary experiences      | `src/app/[section]/page.tsx`, `src/app/learn/[slug]/page.tsx`, `src/components/no-edge.tsx`, `edge-card.tsx`                                                 |
| Account decoration         | `src/app/dashboard/page.tsx`, `src/app/admin/page.tsx`                                                                                                       |
| Verification               | `tests/platform/sport-coverage.test.ts`, `sport-image-loader.test.ts`, `tests/browser/visual-sports.test.ts`, existing browser fixtures and screenshot paths |

## Verification and preview

See [visual QA evidence](qa/visual-sports/README.md) for the complete checks, before/after screenshots, measured performance and limitations. Screenshot fixtures are isolated test documents, not records in the application or public ledger. Earlier Phase 2 and A–F screenshots are preserved.

Final checks passed: TypeScript, lint, 77 platform tests, 26 PostgreSQL tests, 16 browser tests and the production build. The responsive browser matrix covers 55 route/viewport combinations at 390, 430, 768, 1366 and 1920 pixels with no automated accessibility violations, overflow or normal browsing console/page errors. All ten sport routes and the interrupted-photo revisit regression passed.

In the same three-run local homepage comparison, median LCP changed from 284 to 444 ms at 1440px and from 248 to 276 ms at 390px; measured CLS remained zero. Initial transferred bytes increased from 260,705 to 925,255 on desktop and from 256,858 to 450,988 at mobile width. This records the photography cost on an unthrottled local server, not field performance or a mobile-hardware benchmark.

Browser review caught two visual accessibility regressions: the focused skip link partially covered the mobile brand link, and small sport-page section numbers had 4.22:1 contrast. The skip link now enters normal document flow when focused, with a geometric regression assertion; section numbers use a darker colour measured at 5.48:1. Accessibility rules were retained.

Repeated format-specific runtime image-optimizer requests also stalled across navigation. The original assets and standalone Sharp decoding were healthy. Restart recovered one stalled key, but another asset reproduced the failure; increasing test timeouts would have concealed it. Static responsive derivatives and a registered custom Next Image loader remove that runtime dependency. Loader tests validate registered paths and resolution selection, and browser checks verify static delivery, actual decoding and navigation away from an in-flight photo followed by a successful revisit. The exact upstream optimizer fault was not proven or patched.

Local preview: **http://localhost:3000**. Restart with `npm run build` then `npm run start` if needed. No shareable hosted preview or production deployment was created. No imagery is awaiting licensing; future replacements must receive their own rights review.

Pricing, strategy thresholds, historical-data controls, authentication architecture, migrations and server policy logic remain unchanged. No real emails were sent, no paper run was started, and production/DNS were untouched. The existing dedicated Supabase, authorised provider, legal and strategy-validation prerequisites still apply. A visual milestone does not establish a betting edge or readiness for live publication.
