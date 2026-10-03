# Android development foundation evidence

This evidence concerns a real API 36 emulator and a real Capacitor Android debug APK. It does not establish production readiness, Google Play eligibility, a physical-device result or native email verification/recovery.

## Build and boundaries

- Final default `:app:assembleDebug` passed in 1m17s: 208 tasks, 22 executed and 186 up to date. Node 22.14, JDK 21.0.6, Gradle 8.14.3, AGP 8.13 and installed SDK 36 were used. Gradle was limited to two workers and a 1536 MiB heap.
- Artifact: `android/app/build/outputs/apk/debug/app-debug.apk`, 9,503,018 bytes. SHA-256: `f4e52b45a88132c6676bb8e2f80cf4e4a54993a8e574f8a4bc0f1901323e134c`. An ignored local copy is retained at `private-data/android/docked-foundation-debug.apk`.
- The default APK has **WebView inspection disabled** and **no attached server origin**. It packages only the honest setup/offline shell; it does not package `.env`, the Next server, a Supabase secret, a private feed or account credentials.
- `scripts/audit-android-apk.ps1` inspected all 990 ZIP entries for forbidden configuration/key files, generic credential patterns and exact configured local server secrets held only in memory. **PASS, zero findings.** See `apk-audit.json`.
- `:app:assembleRelease --dry-run --no-daemon --max-workers=2` was rejected by the explicit `Docked release is BLOCKED` gate. No release APK/AAB, release signature, upload or distribution was produced.

The separate inspection APK is private acceptance tooling. It attaches only to `http://localhost:3000` through `adb reverse` and must not be distributed. The acceptance script compares the installed APK hash to that designated artifact before using the WebView, reads authorised test credentials directly from ignored fixtures, and records only static check codes. No Auth trace, cookies, callback links or credential/session screenshots are recorded.

## Regression and visual checks

Eight focused native/reference platform tests passed: content-link routing, strict PKCE-code callback parsing, payload-route families, Android release/backup/network boundaries, self-contained offline CSP hashes, fail-closed push eligibility, and price hierarchy/missing-data separation. Three focused browser cases passed for canonical web aliases, mobile card accessibility and forced moved-price reconfirmation. These browser fixtures are separately labelled DEMO in `../phase4/reference-ui/`; they are not native or sporting-performance evidence.

The final run against web build `yJojDyngkNjNiQ7akKDf4` passed **10 setup/read-only assertions**: designated emulator, installed package, installed inspection-APK hash, running process, real Capacitor bridge, portrait overflow, development status, anonymous member denial, landscape overflow and content deep-link routing. These are the exact checks in `public-acceptance.json`; four are prerequisites rather than product journeys. The Back check timed out while Android System UI owned the foreground with an ANR dialog. The raw FAIL receipt is retained and interpreted by the separate `environment.json` record as **BLOCKED_ENVIRONMENT**, never as a passing suite.

An earlier preflight completed Back navigation and showed a readable methodology screen, but that does not establish reliable final native acceptance. The final `anonymous-methodology.png` and `environment-anr.png` show the actual system overlay and are environment evidence. `bundled-foundation.png` is an earlier setup-shell preflight image, before the system-bar styling repair; it is not a final APK acceptance screenshot.

## Material findings and repairs

1. Capacitor's remote development attachment serves `errorPath` locally, but its sibling CSS/JS would use the remote proxy. The fallback is now a generated, self-contained document with exact script/style CSP hashes; its regression rejects network subresources.
2. Generated plugin configuration conflicted with the explicit cleartext prohibition. The manifest retains `usesCleartextTraffic=false`; only the debug localhost network-security exception permits the local development origin. It does not enable arbitrary cleartext or mixed content.
3. System-bar text styling was corrected for the light app background. Cloud backup and device-transfer exclusions were explicitly added, and FileProvider access was narrowed to the necessary app photo/cache paths.
4. The isolated moved-price screenshot exposed a stale current-market summary after the server returned a new review. Both current-market displays now follow the matching server review; confirmation still resets and must be given again.

## Emulator environment and pending acceptance

The first API 36 emulator attempts at 2 GB and 3 GB effective RAM encountered repeated **Android System UI, Phone and keyboard ANRs**, substantial swap use, and process start timeouts. No Docked Java exception was found. The final isolated attempt used **4 GB RAM and four virtual cores**, after all competing web/browser/build work stopped. Android System UI, dialer and keyboard again produced ANRs and activity launch returned timeout. Increasing resources did not resolve the environment failure. `environment.json` records the actual resource snapshot and affected packages; the screenshot visibly confirms the foreground ANR. No additional retries were made.

| Native case | Final status |
| --- | --- |
| Real bridge, anonymous denial, development status, portrait/landscape no-overflow, content deep-link destination | Read-only assertions passed, subject to the visible system-overlay limitation |
| Android Back | BLOCKED_ENVIRONMENT; final assertion timed out under System UI ANR |
| Repaired offline error screen and reconnect/retry | Not reached in final native run; self-contained-resource/CSP regression passed |
| Genuine login, restart/session persistence, private export and authenticated screens | Not run: BLOCKED_ENVIRONMENT; no credential was entered |
| Native share sheet, photo-picker/camera cancellation, logout/session denial | Not run: BLOCKED_ENVIRONMENT |
| Verification/recovery, OAuth, staff MFA, native deletion and physical-device checks | Unverified; additional configuration/device acceptance required |

The emulator was then replaced with the audited default inspection-disabled APK, its task-specific ADB forward/reverse ports were removed, and the task's emulator was stopped. Generated Capacitor configuration has inspection disabled and no server URL. Both final APK copies match the hash above. The real hosted member account was released to the parent workflow for revocation/erasure without ever logging in on Android. No authenticated native screenshot, trace or token exists in these receipts.

Native verification/recovery links, OAuth, staff TOTP, refresh expiry, account deletion/resume after revocation, physical-device accessibility and broad device/Android-version coverage remain separate gates. Hosted browser acceptance does not substitute for them. FCM, permission prompts, token registration, push dispatch and badge writes remain **NOT_CONFIGURED**; no external email or push was sent by these checks.
