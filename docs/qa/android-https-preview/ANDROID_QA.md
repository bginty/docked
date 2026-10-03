# HTTPS Android preview evidence

The owner-authorised architecture is Android → the isolated HTTPS Docked Preview application → Docked Preview Supabase `bckkllmndoxzpzdqrevb`. The canonical application origin is `https://docked-preview-s24-briant-ginty.vercel.app`. Production, production DNS and Oura are outside this work.

## Artifact and audit status

The final hosted `:app:assemblePreview` completed in **1m40s**, with 373 tasks (36 executed, 337 up to date). It used the installed SDK36/JDK21, two Gradle workers and no newly accepted SDK licence. Android lint-vital checks completed as part of the build. The APK contains the refreshed, verified receipt for deployment `dpl_28LrxCbuMSD2EVypPEAuFtd2EVeG`, serving the reviewed web application at commit `4338baf` after the notification transaction repair. That receipt records packaging-time provenance: the stable HTTPS alias subsequently advanced to `226bf6b` for the form and timestamp fixes, without changing this APK. The [current hosting audit](hosting-audit.json) identifies the active server separately.

| Final artifact       | Value                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Filename             | `Docked-Preview-S24-v2.apk`                                                                                      |
| Windows path         | `C:\Users\61412\Documents\ChatGPT\Docked.com.au\android\app\build\outputs\apk\preview\Docked-Preview-S24-v2.apk` |
| Bytes                | 6,716,374                                                                                                        |
| SHA-256              | `a0bbd4ee89109fd1a1ee17b4401eb1c786d8d957bd858ee4b7642e9f0af27be0`                                               |
| Entry URL            | `https://docked-preview-s24-briant-ginty.vercel.app/home`                                                        |
| Supabase project     | `bckkllmndoxzpzdqrevb`                                                                                           |
| Package / version    | `au.com.docked.app.preview` / code 2 / `1.1-preview`                                                             |
| Device compatibility | ARM64 included; minimum API 24, target API 36                                                                    |

The artifact path is `android/app/build/outputs/apk/preview/Docked-Preview-S24-v2.apk`. Read the final byte size, SHA-256, version, signing certificate and compiled policy from [apk-details.json](apk-details.json), and the exact attached origin and inspection status from [apk-audit.json](apk-audit.json). The preview label is **Docked Preview**, package `au.com.docked.app.preview`, version code **2**. The package and signing certificate match the preserved version-1 APK. It upgrades the existing preview package; no uninstall is required for that matching original installation. Cookies from the former localhost origin are not transferred to the new HTTPS origin.

The final ZIP audit inspected **984 entries** with zero credential/forbidden-file findings. The strong scan covered all **984 extracted files** (14,589,240 uncompressed bytes), including binary and encoded secrets, with zero findings or errors. [Extraction coverage](apk-extraction.json), [strong scan](apk-strong-secret-scan.json). Before packaging, the public Android assets also passed the stronger scan: 12 files, zero findings/errors. [Asset scan](android-assets-secret-scan.json). Android debugging, WebView inspection, mixed content and cleartext are disabled. The production release dry-run was rejected by the explicit gate; no release artifact was produced. [Release gate](release-guard.json).

Two audit-tool assumptions were corrected before accepting those results. Optimized Android resources have shortened names, so the policy audit now resolves the actual `xml/network_security_config` resource and verifies the application manifest references it. Case-sensitive APK names can collide on Windows; the extraction helper now writes every entry under a unique indexed name, preserves its extension and verifies its uncompressed size. The earlier partial extraction was rejected and its result replaced by the complete scan. No files or findings were excluded to obtain PASS.

## Native preflight: bounded environment failure

One existing designated API36 emulator was cold-booted with 4 GB RAM/four cores, without snapshots, ADB reverse or port forwarding. Boot completed in 121.513 seconds, and installing over the earlier preview returned **Success**. The launch command returned **timeout**, with a 15.322-second wait.

The actual HTTPS `/home` sign-in gate subsequently rendered with the visible PREVIEW indicator and native settings. The screenshot also contains the foreground **“System UI isn't responding”** dialog. Android events reported Phone, Google Play services, keyboard and other system-process startup ANRs. This is evidence that the hosted application loaded without localhost forwarding; it is **not** a passing cold-launch or interaction suite. [Exact preflight receipt](native-preflight.json), [actual screenshot](native/preflight-system-anr.png).

The attempt was stopped without retries or credential entry. Its APK hash and deployment are retained in the preflight receipt so this earlier screenshot cannot be mistaken for a later rebuilt artifact. The emulator was stopped, no forwarding was created, and the unused disposable QA account was released to the cleanup owner. The durable tester's credentials were untouched.

| Native acceptance                                                                                               | Result                                                                                          |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Package/signature/version upgrade; non-debuggable APK; compiled HTTPS-only policy; disabled WebView inspection  | APK audits passed; emulator installation succeeded                                              |
| No ADB reverse/forward mappings                                                                                 | Verified empty before and after the attempt                                                     |
| Actual remote application and PREVIEW identification                                                            | Visually observed behind the system ANR overlay                                                 |
| Reliable cold/warm launch, background/resume, Back, offline/recovery, keyboard, native sharing and image picker | BLOCKED_ENVIRONMENT; interaction checks not run after system failure                            |
| Native login, session persistence, logout and private routes                                                    | Not run; no credential entered                                                                  |
| Signup/recovery, push, billing, prizes, deals/affiliates, sporting feeds                                        | Remain closed/unconfigured under preview policy; no external delivery or fabricated performance |
| Physical Samsung S24                                                                                            | Unverified; see [device acceptance checklist](S24_ACCEPTANCE.md)                                |

Ten focused native/configuration regressions passed, covering exact preview identity/origin gates, disabled service controls, strict content/auth links, push restrictions and the self-contained offline page/CSP. Scoped lint passed. These source tests and separately recorded real hosted-browser checks do not replace native session/device acceptance.

The architecture needs ordinary Wi-Fi/mobile data and the authorised HTTPS backend after installation. It needs no USB, ADB, Android Studio, development computer or local web server on the user's phone. The complete physical-device lifecycle remains to be verified honestly; the earlier disconnected-shell acceptance records remain preserved separately in `../android`.
