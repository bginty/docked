# Docked Android foundation

Status: **development foundation; release blocked**. This is a real Capacitor Android project, not a claim of Google Play readiness. The existing Next.js application remains the source of its screens, server-side access checks, canonical records, and design. No production site or DNS change is required or made.

## Why the development attachment is explicit

The web application depends on server rendering, same-origin API routes and Supabase SSR cookies. A static export would remove essential authentication and authorisation behaviour. The bundled `mobile/www` contains only setup and network-error screens. By default it connects to no app service. `npm run android:preview` attaches **only** `http://localhost:3000` via `adb reverse`; `capacitor.config.ts` rejects every other server URL. Capacitor documents `server.url`, cleartext and navigation overrides as development facilities, so this mode is not treated as a distributable architecture. [Capacitor configuration](https://capacitorjs.com/docs/config)

A reviewed release must choose and implement a packaged client with an explicitly secured API/session boundary, or an appropriate reviewed web-origin architecture. That decision requires the real deployment origin, store/legal eligibility and complete device Auth acceptance. The Gradle release task graph fails deliberately; there is no environment flag that silently turns it into a release.

## Boundaries

| Area | Implemented foundation |
| --- | --- |
| Identity | `au.com.docked.app`; debug application ID `au.com.docked.app.preview` |
| Platform | Capacitor/core/Android/CLI 8.5.2; minimum API 24; target/compile API 36; Gradle 8.14.3; AGP 8.13.0; JDK 21 |
| UI | Shared Next.js screens, Docked vector adaptive icon/splash, system-bar insets, resize for keyboard, back navigation, small opt-in haptics that respect reduced motion |
| Network | Bundled honest error screen, network reconnection refresh, no offline submission queue, no private-page service worker in native mode |
| Links | Strict typed route allowlist, canonical official/community records, profile/article/ranking destinations; unsupported links and session-token fragments rejected |
| External destinations | HTTPS user-clicked links open a browser surface without the Capacitor app bridge; mixed content and wildcard navigation disabled |
| Media | User-initiated native camera/photo selection fills the existing upload input; authenticated server quarantine and review remain mandatory; no OCR or price verification |
| Sharing | User-initiated system share sheet for record/profile/ranking/article links; access controls still apply. Preview links use `docked://`; no link implies the current live website hosts this application. |
| Push/badges | **NOT_CONFIGURED**. Typed notification routes only. No Firebase SDK, permissions, token registration, channel creation, notification sends or badge writes. |
| Secrets | No `.env` copied into native assets. No service-role key, database credential, mail token or native JS session-token store. Native logging and WebView debugging disabled by default; inspection requires an explicit local-only acceptance switch. Android backup disabled. |

Plugin versions are pinned individually in `package.json` and the lockfile. The CLI's `xcode` dependency is scoped to compatible CommonJS `uuid@11.1.1` to resolve the upstream UUID advisory; CLI sync and the dependency audit are checked after that override. iOS is not created or validated.

## Push integration gate

Future FCM setup requires a dedicated approved Docked Firebase project, Android package registration, genuine credentials supplied outside Git, reviewed notification permission UX, token lifecycle/deletion and server-side delivery authorization. Map payloads through `nativeNotificationRoute`; never trust payload-provided odds, role, identity or arbitrary URLs. Dispatch must recheck the existing global and per-follow opt-in, jurisdiction, quiet hours, suppression, frequency cap and account/session revocation. Badge counts must derive from authorised unread notifications. Until those dependencies and tests pass, the native UI explicitly reports NOT_CONFIGURED. [Capacitor push API](https://capacitorjs.com/docs/apis/push-notifications)

`src/core/native-push.ts` defines the concrete versioned payload and `planNativePush` boundary. A future leased server worker must reload every context field from the database: active account/device, current region/content/actor visibility, consent, push/category/per-follow settings, pause/quiet window, source freshness/cutoff, expiry and counters. It uses the existing official-edge dispatch policy (including two per local day) and a 30-per-24-hour ceiling for all native notices. Invalid/missing values fail closed. Even an otherwise eligible plan currently returns `NOT_CONFIGURED` and a null payload; there is no sender or token-registration endpoint to invoke. Tests exercise revocation, restricted content, blocked actors, no consent, caps, unknown budgets, expiry and quiet hours.

The native photo chooser uses system-mediated access rather than broad storage permissions, does not save photos into a gallery, and requests no camera action on launch. Cancel/deny leaves the file chooser available. [Capacitor camera API](https://capacitorjs.com/docs/apis/camera)

See [Android build and evidence](ANDROID_BUILD.md), [Auth boundaries](ANDROID_AUTH.md), and [Play readiness](GOOGLE_PLAY_READINESS.md). Real device acceptance remains separate from browser fixtures.
