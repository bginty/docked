# Friends Android v18 — 11 October 2026

Owner requested the latest APK be sent to the existing authorised friend. Built and delivered Docked Beta **v18 / 1.17-beta**, connected to https://docked.com.au/app. The accepted hosted deployment is `dpl_2B1cdf6LogHXMK3q4AAEvsm6rP1b`, application commit `cdd7bb497d856d873f8abe030a6cde3074393585`, including the state-selector/signup repair and current released fantasy screens.

The new animated pack presentation remains Preview-only pending the owner's outstanding release choice. No animation activation, website deployment, payment activation, new invitation, account reset, consent submission or card award occurred in this APK delivery. Existing collector follow-up is unchanged.

## Artifact and verification

- `artifacts/android/Docked-v18-NFL-Friends-Beta.apk`, 11,035,942 bytes.
- SHA-256 `1ebd5903b365fae481bdebccbb27cc8883ae7f96b239340168134d52939d261e`.
- Same `au.com.docked.app.preview` package and signing certificate as v17; version increased. Verified update compatibility without uninstalling.
- Gradle beta build passed. Non-debuggable, arm64 compatible, HTTPS-only, no hosting bypass or privileged client credentials. All 988 APK entries scanned, zero findings.
- 17 targeted Android host, archive, version, navigation and offline tests passed. Publisher scoped lint passed. Existing live browser signup/session and domain acceptance from the preceding repair are preserved rather than represented as physical Android tests.
- No emulator or physical device attached. Native installation, Back, keyboard, background/reopen, visual approval and physical S24 acceptance remain pending.
- Anonymous download returned HTTP 200 and matched the APK hash. Existing private storage bucket; no additional paid service.

## Delivery

One owner-authorised update email was submitted by support at **2026-10-11 06:50:40 UTC**. Microsoft Graph returned **202 Accepted**; inbox receipt is unverified. Email provides an APK download link, not a binary attachment, plus the existing account sign-in/setup instructions. No duplicate retry was attempted. Private body, recipient and dispatch fence are retained outside Git; public outcome is `qa/android-v18/email-dispatch.json`.

The download expires **18 October 2026, 17:50 Australia/Sydney**. Version-specific signed capability is in `private-data/friends-cutover/apk-v18-download.json`; do not commit it. Recipient should open the downloaded APK on Android and choose **Update**, preserving the existing app/data. No new password, invitation or verification is needed for the already-verified account. Web alternative remains https://docked.com.au/app.

Previous v17 APK remains archived. A website rollback can use `dpl_AXJQ7zTUAzFLw4phdUJWMg2mRMRy` if required, but that restores the old free-text region bug. Android cannot downgrade normally over a higher version; use a further versioned fix if necessary rather than instructing uninstall/data loss.
