# Edge Signal native branding

The Android resources and offline shells now use the supplied approved artwork. No Docked mark was redrawn, traced, cropped, recoloured or given an additional shadow. Existing highlights, edges and white pixels in the supplied exports are preserved.

## Asset mapping

| Surface | Supplied source | Adaptation |
| --- | --- | --- |
| Android legacy launcher | `public/brand/icons/docked-app-icon-1024.png` | Exact master copy in `drawable-nodpi/docked_launcher.png`; proportional launcher density exports |
| Android adaptive launcher | `public/brand/logos/docked-mark.png` | Contained transparent raster foreground inside the guaranteed visible area, over token navy |
| Android 12+ splash | `public/brand/logos/docked-mark.png` | Contained within the platform splash safe circle, over token navy |
| Earlier splash and generated portrait/landscape variants | `public/brand/logos/docked-primary-on-dark.png` | Proportional, centred artwork over token navy |
| Native and PWA offline shell | `public/brand/logos/docked-primary-on-dark.png` | Exact PNG bytes embedded in the self-contained document |
| Legacy public icon paths | Supplied 192/512 app icons and mark SVG | Byte copies; maskable icon contains the whole master inside the safe circle |

`node scripts/build-app-icons.mjs` regenerates the platform images, Android colors and PWA offline document from the approved assets and `src/brand/brand-tokens.json`. `node scripts/build-mobile-shell.mjs` generates the selected native shell. The APK build runner invokes both once before Capacitor sync.

The native offline CSP still hashes its script and stylesheet. It permits the embedded PNG without adding a remote image request. The existing exact preview origin and retry behavior are retained. The asset guard verifies the embedded image against the supplied PNG before excluding only that image's base64 from human-copy checks. The broader artifact secret checks remain separate and unchanged. The offline font stack uses the approved Sora preference with the system sans-serif fallback available without a network request.

The PWA cache name advances to `docked-public-offline-edge-signal-v2`. Its scope remains the public offline document only; authenticated pages, APIs, prices and private media remain uncached. The obsolete, unused `mobile/www/offline.html` is removed; the generated native document comes from the current template.

## Verification

- Five focused platform tests passed, including existing preview identity/guard tests, exact source-image identity, adaptive/splash bounds, and hashed offline CSP.
- The full platform suite subsequently passed: 187/187 tests in 34.6 seconds. Its existing offline test now accepts only the exact approved embedded PNG, rejects other image/script/link subresource sources, and retains CSP hash checks with concise failure messages.
- Two static browser cases passed at 390px and 1366px in 21.6 seconds. Four screenshots accompany this file. Both documents had no horizontal overflow, accessibility violations, console errors, page errors or HTTP asset requests.
- The Android SDK 36 `aapt2 compile` command compiled the full main resource directory successfully. This was resource compilation, not an APK build or device run.
- TypeScript and scoped ESLint passed.
- Mobile offline, desktop PWA offline, portrait splash and adaptive artwork were visually inspected.

The first isolated checks found a too-large adaptive foreground and a false positive from the letters `ADB` occurring inside PNG base64. Padding and exact-image validation corrected these without relaxing preview identity or secret controls. The first browser harness import was incompatible with Playwright's module transform; the final harness renders the real shell through a separate Node process.

At the resource-only checkpoint, Android versionCode 3 / versionName `1.2-preview` and output filename `Docked-Preview-S24-v3-Edge-Signal.apk` were prepared, and the version 2 hash was unchanged. The later authorized APK build and current-artifact audits passed, but Gradle removed the prior version 2 binary from its output folder. See the [actual build result and preservation incident](README.md), which supersedes the preparation status and records the unrecovered binary honestly. The preview package and signing configuration remain unchanged.

There is no iOS native project. Apple/PWA touch icons use the supplied pack through the web metadata; no iOS binary or native splash is claimed.

The resource sizing follows the official [Android adaptive icon guidance](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive) and [splash screen guidance](https://developer.android.com/develop/ui/views/launch/splash-screen). The supplied raster is used directly rather than replaced with newly drawn vector paths.
