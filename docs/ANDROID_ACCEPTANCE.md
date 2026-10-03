# Android acceptance — Phase 5

The owner reports that the installed v5 APK works on the physical Samsung S24. This is user confirmation of the existing app, not an agent-observed pass for every scenario below. The web UI continues to load from the approved HTTPS preview; Phase 5 scanner/discovery UI alone does not require a new native package.

Preserved artifact: [Docked Preview v5](../artifacts/android/Docked-Preview-S24-v5-App-Entry.apk), package `au.com.docked.app.preview`, versionCode 5 / versionName `1.4-preview`. SHA-256 `3e7af19503c376e8601ca9eef164a17d8a385b73f36aecff19a4a2629929552b`. Existing signature, host allowlist, app entry, release guards, private-response cache policy and preservation archives remain intact. No APK rebuild, device install, signing-key creation or Play upload was performed by the Phase 5 UI work.

## Acceptance matrix

| Area | Phase 5 evidence/status |
| --- | --- |
| Existing v5 physical S24 operation | User confirmed working; exact per-case observations not supplied |
| Five tabs, shell, safe areas, back/keyboard | Final 76-case browser suite passed, including navigation, safe-area/content and keyboard checks; physical native back/keyboard retest remains pending |
| Compact Edges discovery empty/populated | Final DEMO cases passed at 360, 412 and 1366 pixels; genuine hosted member empty state also passed at 412/1366; no live records invented |
| Scanner manual input and revalidation failure | Isolated 390-pixel browser fixture; no typed odds/probability/result controls; revalidation failure remains recoverable |
| Real provider fixtures/current odds | Blocked by missing approved provider configuration/credentials and display rights |
| Genuine trending/weekly recognition | No seeded real engagement or performance; algorithm and disposable SQL tested; hosted actual-data availability remains separate |
| Signup/login/invitation/onboarding/logout/session recovery | Five genuine hosted logins, four staff MFA enrollments, member refreshes and logout/access-denial checks passed. Signup/invitation/onboarding evidence remains the earlier Phase 4.5 run; no new email-verification run claimed |
| Profile/follow/reaction/comment/report/delete/preferences | Existing controls retained and local fixture regressions passed; final hosted QA accounts erased through the existing deletion service. No new genuine community writes were used to create engagement/performance |
| Native sharing, picker, deep links, offline/recovery | No native changes in this phase; detailed Phase 5 physical-device retest not performed here |
| Push, billing, prizes, affiliates, official live publication | Remain disabled; UI work does not activate transports or commercial/publication gates |
| Play closed test | Separate policy, developer-account and owner-controlled upload-signing prerequisites remain; no store approval claimed |

## Manual physical regression after the final preview update

1. Cold launch through `/app`; verify login or the authenticated Edges entry, then background/resume and session persistence.
2. Open Edges, Feed, Following, Points and My Edge. Confirm bottom navigation clears system insets and the keyboard clears active fields.
3. Check no-data, restricted, provider-unavailable and genuine no-edge copy without invented statistics. Any demonstration fixture must remain isolated and conspicuously labelled.
4. Use a disposable authorised account for compose, reactions, comments, save, follow/mute/block, preferences, report and deletion. Never use the owner's account for destructive QA.
5. Test safe internal deep links, Android back, native share and approved image picker. Reconnect after offline mode and confirm no private data are cached for offline replay.
6. Log out, relaunch and verify the session is no longer accepted. Do not mark this matrix passed without recorded observations.

Detailed historic native evidence is retained under [Phase 4.5 Android QA](qa/phase45/android/). New Phase 5 results are stored under [Phase 5 QA](qa/phase5/), with browser fixtures distinguished from genuine hosted sessions.
