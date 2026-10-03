# Android authentication boundary

## Phase 4.5 app entry and lifecycle

v5 starts at the approved HTTPS origin's `/app` session gate. The server routes a verified session to Edges or required onboarding; signed-out users see `/app/login`. Signup, recovery and verification status pages are dedicated app surfaces. Public web entry remains separate.

The native adapter remaps only known marketing/login/recovery paths to app equivalents. It never accepts an arbitrary `next` URL. On protected route transitions, resume and reconnect, `/api/app-session` is queried with same-origin credentials and no cache. Only an explicit HTTP 200 `authenticated:false` opens app login; HTTP 503, invalid data and network loss do not trigger logout. Valid restricted accounts remain authenticated. `onboardingRequired:true` opens the server-owned legal/preferences gate; attestations are never automatically accepted.

Native authentication return links still need the original WebView PKCE verifier. The code-only callback permits `/reset-password`, `/app/reset-password` and `/app/verified`. Bearer tokens, token hashes, fragments, duplicate parameters, foreign hosts and arbitrary routes are rejected. Custom-scheme links are not verified HTTPS App Links; browser-to-installed-app verification remains a physical v5 handoff check until demonstrated.

The owner reports v4 works on their S24. This does not establish v5 authentication/lifecycle acceptance. No native token storage was added. The following earlier implementation notes remain relevant except where the app routes above supersede the original web entry.

**No new native token store or authentication bypass is introduced.** The hosted preview WebView visits the exact verified HTTPS application origin in `config/android-preview.json`; its Next.js backend is bound to Docked Preview Supabase. Existing Supabase SSR cookies, verified server identity, `auth.sessions` checks, region rules and staff MFA remain authoritative. Neither JavaScript Preferences nor localStorage receives access/refresh tokens; localStorage contains only a non-sensitive haptic preference. Existing web cookie options are inherited rather than silently replaced. The separate local developer mode still uses `http://localhost:3000` with ADB reverse; this is not required by the hosted S24 APK.

An upgrade keeps the Android package/signing identity. Cookies from the former localhost origin are not copied to the new HTTPS origin: the user signs in to the actual preview there. A packaged receipt contains public identity metadata only and supplies no account or administrative capability.

## Lifecycle

- Login/signup/onboarding/preferences/logout/export/deletion use existing same-origin forms and APIs. The native bridge does not call the Supabase service role or manufacture Auth rows.
- Resume and reconnection refresh server views. A locally present cookie does not override revoked sessions, disabled accounts, expired eligibility or missing MFA.
- Private responses remain `no-store` under existing server controls. Native mode does not register the web PWA service worker. There is no persistent private offline feed or submission queue.
- Android backups are disabled. A release design still needs a documented device-threat model, appropriate credential storage and real logout/restart/revocation tests. WebView cookie persistence is not claimed to be a dedicated encrypted native session vault.

## Verification and password recovery

The current web flow requires the original PKCE verifier cookie when exchanging an authorization code. `nativeAuthCallback` accepts only `docked://auth/callback?code=...`, with an optional exact `/reset-password` next path. It rejects token hashes, access/refresh token fragments, duplicate parameters, external redirects and arbitrary URLs. The accepted code is sent to the existing same-origin `/auth/callback` exchange; failure returns the existing verification error.

The code parser is groundwork, **not proof of completed native verification/recovery**. No Supabase redirect allowlist, real mail destination, OAuth client or production domain is changed for Android. A verification message opened in a separate browser cannot be assumed to share the WebView's PKCE cookie. Before enabling native signup, implement and test a supported return flow in the original WebView with a dedicated preview redirect and the capture sink. The hosted browser acceptance run does not prove this native path.

OAuth is not configured. Future browser-based OAuth must preserve PKCE/state/nonce, return through a verified destination and exchange once; never import bearer tokens supplied through an app link. Staff actions still need an actual enrolled and verified TOTP factor. No recovery or real email is sent by the native build scripts.

## Deep links

Development custom scheme routes include `docked://edges/<UUID>`, `docked://results/<UUID>` (both open the canonical `/tips/<UUID>`), `docked://community/<UUID>`, `docked://community/edges/<UUID>`, `docked://profile/<handle>` and `docked://learn/<slug>`. All normal server visibility checks apply after routing. There is no password, token, price or role field accepted by content links.

Verified HTTPS App Links remain **BLOCKED** until an authorised deployed origin and real release signing certificate exist. Production verification requires the correct `assetlinks.json` and manifest host/path declarations, followed by device verification; a custom scheme alone does not prove domain ownership. No file is published on docked.com.au. [Android App Links verification](https://developer.android.com/training/app-links/verify-applinks)

Required native acceptance: verification in original context; login/restart persistence; refresh expiration; resume after revocation; logout; recovery; deletion and old session denial; cross-app link rejection; staff TOTP. Record each actual result rather than carrying browser PASS statuses into this list.

During the earlier Phase 4 foundation acceptance on 3 October 2026, actual emulator bridge and anonymous/deep-link assertions passed, but repeated Android System UI/keyboard/dialer ANRs blocked the native lifecycle run even after an isolated 4 GB/four-core restart. **No genuine account credentials were entered in that Android run.** Its login, persistence, export, share/media and logout cases remain unrun, not inherited from hosted-browser PASS results. See [the preserved foundation receipts](qa/android/README.md).

The later HTTPS preflight loaded the real application without ADB forwarding, but the same designated emulator produced a visible System UI ANR and Phone/keyboard/Google-services startup failures. It was stopped after one bounded attempt, again before any credential entry. The final hosted APK was subsequently rebuilt and audited with the corrected backend deployment receipt. At that historical v2 milestone, native account persistence/login/logout and physical S24 acceptance remained unverified; [the hosted Android receipts](qa/android-https-preview/ANDROID_QA.md) distinguish those limits from successful APK/browser checks.
