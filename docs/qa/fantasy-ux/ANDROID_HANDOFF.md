# Connected owner QA — v12

APK: [Docked v12](../../../artifacts/android/Docked-v12-Owner-Connected-QA.apk). Protected backend: https://docked-production-72jth6bfn-briant-s-projects.vercel.app. This is a connected HTTPS APK, not the bundled QA build.

1. Download the private APK link supplied in chat, or copy the local file to the S24 by USB.
2. In Samsung My Files → Downloads, open `Docked-v12-Owner-Connected-QA.apk`. Permit installation from My Files if prompted, then choose **Update**. Do not uninstall or clear app data.
3. Open Docked Preview. Complete normal Vercel protection if needed and use the existing owner login/MFA. Do not reset or enrol another factor. No protection bypass or privileged credential is embedded.
4. Follow [the physical checklist](../../FANTASY_UX_ACCEPTANCE.md#owner-s24-checklist). Report any browser/WebView handoff loop rather than disabling protection.

Version 12 / 1.11-preview; package/signing matches v11; SHA256 `116616c68bf9483f50b86ea312de4e7224517c2f9f90034c00641dd83c8a1c22`; ARM64, Android API24+, target36. Account isolation is enforced server-side. Registration, external testers and hosted market transfers remain closed.

Owner login is already accepted. V12 session reopening, gameplay on a physical S24 and visual approval remain pending. Emulator launch passed on retry after an Android system restart; it does not establish authenticated gameplay.

Observed emulator foreground: Chrome first-run activity during protected access. No owner session was supplied. Native process remained alive with zero fatal-exception lines for the current app process. This handoff is still a device acceptance item.
