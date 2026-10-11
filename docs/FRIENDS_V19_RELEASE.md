# Friends Android v19 — 11 October 2026

Owner explicitly requested including the new pack-opening experience in Barry's update. This supersedes the earlier Preview-only release restriction; it does not claim physical S24 or final owner visual acceptance.

## Website

https://docked.com.au/app now serves application commit 1b739f614b609172a87e3a06bad1d09b802184a8, deployment dpl_4tVojz4nS3VqdCCKDGEmpzVpFEan. The separately gated animated pack viewer is enabled only in the exact invitation-gated friends beta. The synthetic design route remains 404 on production. Signup state-selector repair remains included. Payments, prizes, withdrawals and external public signup remain off. Collector schedules/follow-up are unchanged.

The server assigns the original ten-card NFL starter pack once. Opening, skipping, resuming and replaying display that saved receipt; no rarity or ownership decision comes from animation. Existing members can use Cards → View saved pack result. No Barry account, consent, inventory or password was changed.

## Executed verification

- Typecheck and lint passed; staged production web build READY.
- Eight pack/friends guard tests, seventeen Android/navigation/offline tests, and the exact NFL allocation/receipt database scenario passed.
- Seven local browser journeys at 360/412/1366 px passed: customer signup, interruption/lost response, duplicate taps, resumed multi-card reveal, single-card reveal, keyboard/reduced motion and accessibility. Initial sandbox Chromium was unavailable; host-installed Chromium ran successfully.
- Hosted candidate and actual custom-domain tests used an existing isolated synthetic member. Normal member login had no MFA requirement. Actual saved ten-card receipt, refresh/resume, summary/replay, reduced motion and mobile/desktop dialogs passed. Zero dialog axe violations, page errors or award POSTs; account/consent/holdings snapshots unchanged. Synthetic roster disabled again in finally. This is hosted receipt/replay acceptance, not a claim Barry completed signup or opened his pack.
- Fifteen live HTTPS/callback/origin/private-data boundary checks passed.
- First candidate test had an ambiguous player heading selector; narrowed to the active reveal heading without weakening assertions.

## Runtime repair

Live-domain refresh exposed SQLSTATE53300: eight idle Supavisor connections filled the beta role's old connection cap. Read-only diagnostics verified max_connections=60 and sixteen other connections. Increased only docked_beta_app's resource cap 8 → 16, preserving at least twenty spare slots after the full beta allocation. All role privileges were compared unchanged; no sessions terminated, account reset, service upgrade or database data migration. Audited in beta_private.audit_events; first attempt rolled back atomically because audit subject was omitted, then corrected.

Hosted refresh/resume then passed; post-check count was nine idle beta connections within sixteen. Vercel error/warning query for 07:04:23–07:05:09 UTC returned no records. This is bounded observed acceptance, not a claim of unlimited scaling. See qa/android-v19/connection-budget.json. Connection guidance: https://supabase.com/docs/guides/database/connection-management . Future scale should evaluate transaction pooling with a separate session-state review; this release preserves existing transaction/session semantics and prepared-statement settings.

## Rollback and pending human checks

Website rollback target: dpl_2B1cdf6LogHXMK3q4AAEvsm6rP1b (previous signup-fixed friends release). The read-only receipt function remains safe unused. Resource-cap rollback is ALTER ROLE docked_beta_app CONNECTION LIMIT 8, but investigate saturation before reducing it. No destructive database rollback is needed. Keep current package/signature for further Android fixes; do not uninstall or clear data to downgrade.

Physical S24 install, sound/haptics, native Back/keyboard, background/reopen and owner visual approval remain pending. No emulator/physical device was used in this release. Fresh unattended NFL collection and genuine member-round observation remain pending under the existing follow-up. No additional cost.

## Android and delivery

Docked Beta v19 / 1.18-beta: artifacts/android/Docked-v19-NFL-Friends-Beta.apk (11,035,938 bytes). SHA-256 ef55d4e63119de0832c808801d9edefe0ae9427c763061a152e29d578a1b8c92. Gradle BUILD SUCCESSFUL. Same au.com.docked.app.preview package and certificate as v18/v17, non-debuggable, HTTPS-only. All 988 APK entries scanned with zero credential/forbidden-file findings. Version-specific artifact and earlier versions are archived.

Existing private delivery bucket; anonymous download returned success with the exact hash. Signed download expires 18 October 2026 at 18:06:58 Australia/Sydney. Capability retained privately in private-data/friends-cutover/apk-v19-download.json, never in Git.

Exactly one owner-authorised update email to the existing approved friend was accepted by Graph (202) at 2026-10-11 07:07:08 UTC. It explicitly supersedes the earlier v18 email and describes pack replay with no new awards. Inbox delivery is unverified. Email contains the APK download link rather than a binary attachment. Body/fence retained privately; receipt qa/android-v19/email-dispatch.json. No new invitation or account setup was performed.

Open the downloaded APK on Android, permit installation from the downloading browser if prompted, and choose Update over the installed Docked Beta. Do not uninstall or clear data. Use the existing account. Web alternative: https://docked.com.au/app .
