# Samsung S24 acceptance

This checklist is for the hosted **Docked Preview** APK. It does not require USB, ADB, Android Studio, a laptop or a local server after installation. Internet access and the approved preview backend are required. The prior disconnected foundation APK is not this deliverable.

Final artifact identity, URL and checksum are in [Android QA](ANDROID_QA.md) and the build receipts in this directory. Verify the delivered file against those receipts before installation. The new APK retains `au.com.docked.app.preview` and the existing signing identity, with version code 2; its final signature/upgrade audit passed against the preserved version-1 APK. Credentials must be provided privately and are never packaged into the APK.

## Device checks

All rows below are **PENDING on a physical Samsung S24** until an actual device result is recorded. Browser, source and emulator results do not change that status automatically.

| Check                       | Expected behavior                                                                                                                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upgrade                     | Install the audited APK over the earlier Docked preview without uninstalling; launcher label is Docked Preview.                                                                                          |
| Cold launch, ordinary Wi-Fi | With the laptop disconnected/off, open the application. The real Docked home or its genuine sign-in gate appears with PREVIEW identification. No ADB/local-server instructions appear.                   |
| Mobile data                 | Repeat with Wi-Fi disabled and mobile data enabled.                                                                                                                                                      |
| Warm launch / resume        | Background the application, reopen it and verify the current route and refreshed access state.                                                                                                           |
| Login / persistence         | Use only an approved preview account, then background, close and reopen the app. Server account/session policy remains authoritative.                                                                    |
| Home / pinned edges         | The actual feed and official pinned area render. An empty or restricted state stays honest; no fixture records appear.                                                                                   |
| App navigation              | Open Edges, Post, Community, Top Docked, Profile, Notifications and Settings. Region/account restrictions remain visible and enforced.                                                                   |
| Post                        | Exercise social posting only if the tester's current policy permits it. An absent odds provider prevents a verified price submission.                                                                    |
| Keyboard                    | Focus login and permitted text fields; focused controls and submission actions remain reachable above the keyboard.                                                                                      |
| Back                        | Back returns to the previous application route; at the root it minimises the app without opening a development shell.                                                                                    |
| Native image picker         | On an eligible social form, choose a permitted image or cancel. Oversized images are rejected and all successful uploads still enter moderation quarantine.                                              |
| Native sharing              | Open the system share sheet from an accessible supported page, then cancel or deliberately select a destination. Nothing is sent automatically.                                                          |
| Deep links                  | A supported `docked://` content link routes to its actual record or genuine access/not-found state; arbitrary hosts, private tokens and admin destinations are rejected.                                 |
| Offline / restoration       | Turn connectivity off. The app reports that current/private data cannot be verified and does not queue submissions. Restore connectivity or tap Retry; it reconnects only to the approved HTTPS preview. |
| Logout                      | Log out, revisit a private route and restart the app; the account gate appears.                                                                                                                          |
| Signup / recovery           | Under the current closed delivery policy these are unavailable. Do not enable real email or bypass the policy merely to complete this row.                                                               |

Record the APK SHA-256, Android/One UI version, network type, date, each actual outcome and any reproducible issue. Screenshots may show public pages and honest access gates; omit passwords, recovery links, session material and private account data. A backend outage is distinct from an Android defect and should be recorded accurately.
