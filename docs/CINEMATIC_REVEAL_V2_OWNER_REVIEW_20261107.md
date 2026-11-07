# Cinematic reveal V2 — owner-review prototype

Status: Legendary and Icon implemented for visual review. Not deployed. The other four rarities retain V1. This work starts from `afa144cd` on `codex/premium-card-reveal`.

## Open the prototype

The local preview is running at <http://127.0.0.1:3137/preview/pack-opening>. Select **V2 Legendary**, **V2 Icon**, or **V2 nine-card preview**. AFL is selected initially; NFL and NRL use the same renderer. Original V1 buttons remain below for direct comparison. Enable Sound explicitly to hear the original score; browser screen recordings are silent.

If the server has stopped, run from this worktree in PowerShell:

```powershell
$env:DOCKED_PACK_REVEAL_PREVIEW='true'
npm.cmd run dev -- --port 3137
```

The existing server preview guard denies this route in Production. New effects require `preview` and `cinematicPrototype`, an NFL/AFL/NRL receipt, and a Legendary/Icon tier. No real opening caller enables the prototype. The preview uses clearly labelled deterministic sample players and the existing Docked card/jersey renderer; it creates no inventory or charges.

Review artifacts are in:

`C:/Users/61412/.codex/visualizations/2026/10/02/01a0fc4b-1049-7211-91c9-af9141548b22/docked-cinema-v2/final/`

- `review.html`: review page with both videos and the comparison boards.
- `legendary-afl-full.webm`, `icon-afl-full.webm`: uninterrupted reveals, trimmed only to remove page loading.
- `legendary-comparison.png`: approved reference, V1 and V2 at announcement, turn and final player stages.
- `icon-comparison.png`: V1/V2 at the same stages. The supplied concept has no full-size Icon sequence; no replacement reference has been invented.
- `v1-*-*.png`, `v2-*-*.png`: original full-screen stage captures. Flip study images hold the real animation near 72 degrees for comparable angles. Full videos are not paused or slowed.
- `layout-*.png`, `layout-flip-*.png`: mobile/desktop composition and turn bounds.
- `performance.json`, `capture-results.json`, `flip-studies.json`: actual measurements.

## What changed

Two additive Canvas planes now surround the DOM card. Projected energy rings have separate rear and foreground segments, moving comets, broad light halos and white-hot cores. Seeded sparks, streaks and Icon crystals have different depths and motion. Cached feathered light textures provide stadium shafts, atmospheric haze, radial bursts, an illuminated elliptical platform and reflected light.

The card shell has original faceted crown/diamond emblems, cut-corner metallic frame layers, bright interior rails, engraved detail and visible side thickness. It lifts, pitches and moves towards the camera as it rotates. The existing card front becomes visible on the reverse side during the turn. A single eased flash peaks at the midpoint, followed by a shockwave and settling frame glow. The camera excursion was reduced after a capture revealed the edge reaching the header; final measured bounds fit within the stage at every checked width.

Legendary uses gold/orange illumination, crown, four orbit planes and up to 155 spark particles. Icon uses diamond-white/ice-blue light, a faceted diamond, five planes and up to 210 particles including crystals. These are effect counts only, unrelated to rarity probabilities or supply.

The active reveal timings are approximately 3.1 seconds for Legendary and 3.7 seconds for Icon, followed by a settling effect. Skip and Reveal All remain available. Audio is synthesized locally with separate charge, announcement, rotation and impact layers; Legendary uses lower warm harmonics and Icon uses brighter crystalline harmonics. Sound defaults off, requires user action and stops on skip, mute, close or backgrounding. Existing optional haptic handling is preserved.

## Reference assessment

| Criterion | V1 observed | V2 prototype | Remaining visual distinction |
|---|---|---|---|
| Frame brightness/complexity | Thin, mostly uniform glowing border | Multiple metal/light rails, white-hot edges, cut corners and lens flares | Procedural clean metal rather than the concept's painted fiery texture |
| Orbit visibility | Faint and often hidden behind the card | Four/five bright depth-separated moving orbits | Ring composition changes with time; not a pixel copy of a static illustration |
| Particles | Few small, short-lived dots | Depth-scaled sparks, trails, comets, crystals and expanding reveal burst | Particle density adapts on slower hosts |
| Background | Mostly empty dark panel | Light shafts, haze, radial energy, lit platform and reflections | 2D composited volumetric-style light, not physically simulated 3D fog |
| Crown/diamond | Small flat emblem | Large original faceted emblem with luminous material | Original Docked geometry, not extracted concept artwork |
| Flip | Flat-axis turn and blank far face | Perspective, pitch, camera movement, side thickness and the actual front face | DOM 3D card, not a full 3D mesh/physical simulation |
| Player impact | Card appears after the turn | Card emerges through a burst, particles and settling premium frame | Existing jersey artwork is preserved; the concept's human illustration is not substituted |
| Overall | Functionally correct, weak environmental depth | Clearer foreground/background depth and substantially stronger illumination | Owner visual acceptance is pending; exact reference parity and Samsung 60 fps are not claimed |

## Architecture choice

Canvas 2D plus the existing DOM/SVG card was selected after evaluating a WebGL/Three.js scene, PixiJS and pre-rendered animation overlays. This scene consists mainly of additive light and particles around an existing vector/DOM card; it does not need a new player mesh or a game engine. Replacing the card with a WebGL texture would add a capture/loading path and context-loss recovery. Pre-rendered full-screen films would add mobile asset weight and fixed aspect/timing constraints. No new runtime library or paid service was added.

The implementation follows the cached-sprite, layered-canvas and `requestAnimationFrame` approach described in [MDN's Canvas optimization guidance](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas). WebGL remains a possible later option if profiling on the supported Samsung shows a GPU-backed particle implementation is necessary; [context lifetime and blocking-call considerations](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) would then need explicit handling.

Effects render outside React state updates. Backing resolution is capped at 1.5×, falling to 1× with fewer particles/orbits when CPU/frame budgets are exceeded or the device reports few cores. Settled effects reduce their counts. Reduced motion uses a static draw and no animation loop. Hidden-page rendering stops; close cancels RAF/listeners/observers and releases canvas memory. Missing Canvas support preserves the CSS/vector card and receipt flow.

## Verification actually executed

| Check | Actual result |
|---|---|
| Existing pack browser suite plus initial V2 tests | 20 passed, including existing nine-card opening, replay, keyboard/accessibility, sharing and old NBA receipt preservation |
| Final focused V2 browser suite | 10 passed: two prototype rarities across NFL/AFL/NRL, identity hidden before turn, one issuance, opt-in gate, lower rarity preservation, rapid taps, Skip/Reveal All, interruption/resume, reduced motion, no-Canvas fallback, 1080×1920 download, low-power resolution cap, original audio |
| Pack/supply/wallet/refund platform tests | 43 passed across six targeted test files; includes refunded/spent/transferred cards, retries, exact pack quantities, supply atomicity and coupons |
| V2 scope gate | 1 passed; excludes NBA/NBL/unknown sports, unapproved rarities and ordinary real-pack callers |
| Typecheck | Passed (`tsc --noEmit --incremental false`); production build also runs TypeScript |
| Lint | Full repository lint passed; added/changed prototype scripts were also checked after later additions |
| Production build | Passed locally; this is compilation, not deployment |
| Actual local Next route | Full Legendary/Icon recording; baseline V1 controls; screenshots at 320, 360, 390, 412, 430 and 1366 CSS pixels; no horizontal overflow; completion actions visible; measured flip face stays within its stage |
| Android attempt | No Samsung connected in ADB. Existing read-only API 36 AVD booted and reached the preview, but Chrome and System UI became unresponsive before reveal acceptance. Attempt timed out; screenshot/log retained under `android/`. Emulator was shut down without saving state. No Android pass or physical-device performance claim. |

The first extra sharing test failed because the test looked for “Share My Pull” as the dialog title; the real dialog is “Share your pull”. The selector was corrected, and the real image-generation/download test then passed. This did not require a product change.

## Measured performance and limits

Measured in headless Edge on Windows at 412×850 CSS pixels and 2× device DPR, without video/screenshot capture during sampling. The idle page itself measured 53.5 fps, with a median interval near 18.1 ms.

| Run | Measured mean fps | 95th percentile frame interval | Mean Canvas draw time | Quality |
|---|---:|---:|---:|---|
| Legendary, normal CPU | 40.7 | 18.7 ms | 1.51 ms | High |
| Icon, normal CPU | 54.5 | 18.4 ms | 1.72 ms | High |
| Legendary, 4× CPU slowdown | 48.4 | 18.6 ms | 4.65 ms | Balanced |
| Icon, 4× CPU slowdown | 47.5 | 18.4 ms | 4.93 ms | Balanced |

The first Legendary run included a roughly 1.02-second scheduling gap, which is included in the reported mean, not excluded. Other measured maximum gaps were approximately 109–326 ms. The active effect rendering is inexpensive relative to these gaps, but their cause has not been established on a physical device. **A sustained 60 fps acceptance is not passed.** The final handset check must profile cold/warm playback in Android WebView, background/resume, sound/haptic opt-in, share/save and thermal/battery behaviour. Desktop CPU throttling is not a substitute for that check.

## Preservation and release boundary

No schema, service, migration, wallet, ownership, serial, card-supply, pack-price, probability, payment, refund, competition or sport-visibility configuration changed. All animation inputs come from the existing confirmed receipt. Replay/refresh remain presentation-only. NBA's renderer and data are unchanged. Share My Pull uses the existing private-data-free export path.

No deployment, upload to an app store or commercial activation was performed. This branch is an owner-review prototype. The next decision is visual approval of Legendary and Icon (lighting, movement, density and timing); only after that approval should V2 extend to the other four rarities. Android acceptance and explicit production deployment approval remain separate requirements.

## Reproduction

Set `DOCKED_VISUAL_EVIDENCE` to an absolute directory outside the repository when running evidence scripts/tests. Useful entry points:

- `scripts/cinema-v2-final-capture.ts`: uninterrupted video, stage images, mobile/desktop bounds.
- `scripts/cinema-v2-flip-studies.ts`: matched ~72-degree turn stills (run after final-capture).
- `scripts/cinema-v2-performance.ts`: idle baseline and normal/4× CPU measurements.
- `scripts/cinema-v2-review-assets.mjs`: comparison boards and review HTML.
- `scripts/cinema-v2-android-check.ts`: explicitly targets disposable `emulator-5556` only; never selects the owner's phone implicitly.
- `playwright.pack.config.ts`: existing pack regression plus V2 acceptance.
