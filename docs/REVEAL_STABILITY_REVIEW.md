# Reveal stability — released 15 October 2026

Continues from live Premium v3 source `1a726368` and release receipt `75a71ab8`. The owner subsequently authorised deployment of this reviewed fix. No database changes, purchases, grants or member mutations are required. Deployment completion is recorded separately below when verified.

## Diagnosis and change

The supplied `reveal-update.webm` was decoded successfully (412 × 740, 25 fps). It shows the local synthetic rarity gallery. Reviewed frame sequences show overlapping pack/tunnel effects and an abrupt transition into inspection. The code also had a reproducible timing defect: a fixed 1,800 ms timer removed the turn animation regardless of its actual compositor progress. A normal-transform sampling test alone did not cover that delayed-animation case.

- Keep one keyed, 1.4-second forward half-turn for each confirmed card. Retain its finished animation and explicit identity transform during inspection, rather than removing its compositor transform at completion.
- Enable inspection from `animationend`. Backgrounding and a five-second recovery watchdog explicitly finish the animation before enabling controls. Reduced motion and Simple view remain immediate.
- Remove the moving tunnel from the card reveal; use a restrained light behind the card. A new opening has a brief seal exit before the turn; a saved replay does not repeat that pack overlay.
- Fit the Icon halo/fireworks within the same reveal duration, preserving its pearl frame. Reset tilt on replay.
- Leave server opening, receipt contents, prices, probabilities, supply, ownership and progress keys unchanged.

## Preview and evidence

- [Interactive six-tier preview](http://127.0.0.1:3023/preview/rarity-frames) — select **Preview six-card reveal**.
- [Nine-card preview](http://127.0.0.1:3023/fantasy/reveal).
- [Updated six-tier recording](qa/reveal-stability/reveal-update.webm).
- [Nine-card, Skip and recovery recording](qa/reveal-stability/nine-card-reveal.webm).
- [Rare settled card](qa/reveal-stability/reveal-outer-1.png), [Icon effect](qa/reveal-stability/icon-celebration.png).

Local server: `node --import tsx scripts/marketplace-local.ts --serve --visual --premium-v3`. It uses isolated synthetic fixtures and no hosted database.

## Verification

- **14/14 browser checks passed**, including all nine reveals, consecutive identical rarities, rapid taps, Skip, close/reopen, lost-response recovery, replay, single-card packs, reduced motion, keyboard/focus, accessibility, short/changing viewport fit and existing visual navigation regressions. [Raw results](qa/reveal-stability/browser-results.json).
- New regression pauses the actual CSS animation past the former 1,800 ms deadline; Next stays disabled. It verifies monotonic rotation, less than 0.05 px geometry change at the finish/inspection handoff, retained finished animation, no later reversal, and pagehide recovery.
- **10/10 focused platform checks passed**: `pack-opening.test.ts`, `pack-tier-ranking.test.ts`, `premium-pool.test.ts`. These include persisted progress isolation, all Premium rarity boundaries, nine-card/different-player issuance, supply failure rollback, idempotent purchase/open retry and original historical results.
- `npm run typecheck` and `npm run lint`: passed.
- Clean-environment production build and client-boundary canary scan: passed; markers absent from 55 browser assets. [Build](qa/reveal-stability/build.txt), [boundary](qa/reveal-stability/client-boundary.txt).
- Manually inspected decoded frames of the old and new recordings and the settled mobile screenshot. The frame remains around the complete card and controls fit the test viewports.

Browser evidence uses synthetic/local fixture transport. It is not hosted transactional acceptance or physical Android/S24 verification. The latest Icon timing was loaded before the final rarity and delayed-animation browser checks. No new database test run was necessary for these presentation-only changes.

## Files and remaining review

Application: `src/components/pack-opening.tsx`, `src/app/mobile-cleanup.css`.
Verification: `tests/browser/reveal-stability.test.ts`, `tests/browser/rarity-frames.test.ts`, `tests/reveal-stability.config.ts`; build helper accepts `--reveal-stability` to preserve previous release evidence.

Owner release approval received. Physical S24 replay check remains pending: check several consecutive cards, tilt only after settling, Skip, close/reopen and reduced motion using an already-opened pack. No purchases are needed. Application rollback target is `dpl_3Etm1PzzUD6CsJNv6pvNkjMZFNYh` / source `1a726368`, which already supports Premium v3. Do not revert economy configuration or member data.

## Live release receipt — 16:26 Sydney

- Live: https://docked.com.au/fantasy/cards. Both docked.com.au and www aliases verified against deployment `dpl_EQTfcz1qZ7HoYgLPJBgk6xRUVodn`.
- Application source: `7c1303f388d40483113be57d88ec16e5eb2afdc0`, pushed to the existing working/review branches. Exact committed web export, production target, `--skip-domain`, followed by candidate acceptance and authorised promotion.
- Existing project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, team `team_tf6xweKKyVCj9bTppUKttJ4l`, runtime project ref `pojoymtniryarxxunyvz` verified. Deployment protection unchanged.
- [Candidate](qa/reveal-stability/candidate.json) **8/8 passed**; [live](qa/reveal-stability/live.json) **8/8 passed**. These are anonymous read-only HTTP/version/asset and admission checks, not hosted member transactions or physical-device verification.
- [Release decision](qa/reveal-stability/decision.json), [rollback reference](qa/reveal-stability/rollback.json). The unchanged raw secret scanner reports one intentional build-canary template, with zero exact known-secret matches; [reviewed classification](qa/reveal-stability/secret-review.json) is retained separately from the raw FAIL. No exclusions added or private capabilities committed.
- Android package `au.com.docked.app` remains connected to `https://docked.com.au/app`. Fully close and reopen the installed app; refresh an open browser page. No new APK, reinstall or cleared app data is required.
- No database/configuration migration, member purchases, grants, trades, team edits, messages or invitations. Premium v3, Standard and all persisted receipts remain unchanged. Real payments, withdrawals, prizes and public registration remain disabled. Additional recurring cost $0.
- Roll back only the application to `dpl_3Etm1PzzUD6CsJNv6pvNkjMZFNYh` if necessary; it includes the current Premium disclosures. Never restore an older database state over subsequent member activity.
