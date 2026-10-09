# Owner fantasy QA visual review

**Owner visual approval: PENDING. Physical Samsung S24: PENDING.**

## Real hosted QA state rendered locally

These screenshots use the actual isolated hosted owner card/result snapshot and the real UI components. Their visible heading identifies local rendering. They do not claim an authenticated hosted browser or device session. Fictional player cards and simulated scores are QA data.

| Screen | Mobile 412px | Desktop 1440px |
|---|---|---|
| Play / lineup / simulated rankings | [Mobile](screens/play-412.png) | [Desktop](screens/play-1440.png) |
| Collection | [Mobile](screens/cards-412.png) | [Desktop](screens/cards-1440.png) |
| Card details | [Mobile](screens/details-412.png) | [Desktop](screens/details-1440.png) |
| Market disabled | [Mobile](screens/market-412.png) | [Desktop](screens/market-1440.png) |
| Social tab component | [Mobile](screens/social-412.png) | [Desktop](screens/social-1440.png) |
| Profile | [Mobile](screens/profile-412.png) | [Desktop](screens/profile-1440.png) |
| Simulated connection error | [Mobile](screens/error-412.png) | [Desktop](screens/error-1440.png) |
| Loading / in-flight controls | [Mobile](screens/loading-412.png) | [Desktop](screens/loading-1440.png) |
| Successful refresh | [Mobile](screens/success-412.png) | [Desktop](screens/success-1440.png) |
| Empty collection projection | [Mobile](screens/empty-projection-412.png) | [Desktop](screens/empty-projection-1440.png) |

The Social screenshot is the tab component, not a claim that the HTTP social timeline was rendered under the owner's session. Backend post/comment/reaction/save persistence is independently verified. The first hosted access-page check detected an insufficiently distinguished MFA link; the repaired link is underlined. Initial evidence remains in `hosted-initial-accessibility.json`.

## Owner checklist

Connected APK installation details and emulator-only evidence: [Android handoff](ANDROID_HANDOFF.md). The emulator launch passed after a launcher recovery, but protected sign-in/session/gameplay remain pending. This is not S24 acceptance.

1. Review the five tab screenshots and flag visual changes; approval is still yours to give.
2. Open the final protected Preview URL from the acceptance report. Sign in normally as the existing owner; use the existing authenticator if challenged. Do not reset the password or enrol another factor.
3. Install the **connected v11 QA APK**, then confirm it reaches that same protected Preview. Complete Vercel access if requested. Stop and report any protection handoff loop; do not disable protection.
4. On the S24, check portrait spacing, system bars, keyboard/search fields, back navigation, card details, lineup selection and all five tabs. Confirm Market accurately states its restriction.
5. Background/reopen the app, switch networks, test offline/retry, then sign out and confirm card/account data is denied. No purchase, prize, real-money transfer or external invitation is part of testing.
6. Report browser/device results separately from visual approval. Complete authenticated owner acceptance before requesting a separately capped private-beta admission milestone.
