# Docked mobile application UX

This work continues the clean `codex/docked-value-platform` branch at `0b1de08`. The supplied five-phone Docked mockup is the acceptance target. Existing Edge Signal artwork, API contracts, authentication, MFA, jurisdiction checks, publication gates, benchmark accounting and database policies remain in place.

## Implemented

- A compact mobile navy shell with the supplied on-dark wordmark, notification/settings actions and persistent **Edges / Feed / Following / Points / My Edge** tabs. Active navigation uses an accessible blue derived from the approved electric-blue token. Desktop retains broader navigation.
- `/home` opens `/edges`. Existing Home feed URLs retain their tab, sport and cursor through explicit canonical redirects. `/feed`, `/following`, `/points` and `/my-edge` have explicit middleware/deep-link allowlisting. Arbitrary auth/deep-link parameters remain rejected.
- Edges has Featured, Upcoming and Recent views, a truthful research/monitoring status, retained source/sport/competition controls, and compact official/community record cards. Current observations, captured prices, the locked estimate and minimum price remain distinct. Losses, reviews and corrections remain accessible.
- Feed has compact author/content/action rows, accessible icon/count controls, ordinary posting and the existing media, reaction, comment, save, share and reporting actions. Load more appends authorised pages. Its memory bound preserves whole pages and an unconsumed continuation cursor. Private rows are not persisted; refresh, mutations and rejected authorization clear/revalidate the projection.
- Following uses real following feed/graph/discovery queries. Empty relationships are presented honestly, with suggested accounts only when returned by existing privacy-aware read models.
- Points provides explicit unavailable balances, separate current-UTC-month and lifetime verified performance, and the existing qualified Top Docked monthly leaderboard. Standard units are never presented as points.
- My Edge is a compact personal hub with existing profile editing, posts, permanent Edges, saved items, relationships, notification preferences, help, account controls and POST logout. Account settings retain the mobile shell.
- Authenticated native safe areas share one inset contract. The bottom bar moves out of the way only when an editable field and a materially reduced visual viewport indicate keyboard occlusion. Preview settings moved into My Edge; native offline/error notices remain visible. Native system bars use light glyphs on the dark shell.
- Signed-out mobile navigation uses Sign in/Join free with a collapsed secondary Explore menu. Supplied icons, splash and offline artwork are retained. Static loading skeletons verify identity before rendering member chrome.

## UI scaffolded / backend future work

No points/XP/levels/rewards ledger exists. Monthly and lifetime points are **Not enabled**. Persistent sport/competition follows are not implemented by the current backend; the Sports filter offers labelled browsing. No reputation, performance, ranking, social relationship, sporting result or price was fabricated. Authorised provider data, legal access, validation and publication remain external prerequisites for genuine live records.

## Reusable presentation

`AppShell` / `AppIcon`; `EdgeBoardHeader`; compact `EdgeCard` and `CommunityEdgeCard`; `PinnedDockedEmpty`; `FeedTabs`; `SocialCard`; `SocialTimeline`; `FollowingContent`, `PointsContent`, `MyEdgeContent`; `MemberIdentity`, `MemberList`, `MemberMetrics`, `MonthlyLeaderboard`, `MemberEmpty`, `ProfileMenu`; `AppScreenLoading`; `NativeAppSettings`.

The [exact changed-file inventory](CHANGED_FILES.md) groups every application, native, tool, test and documentation change. Its [complete JSON list](changed-files.json) also names every saved screenshot. The native/hosted acceptance tooling and artifact manifests are committed in `aa27504`.

Only the existing supplied brand assets are used: `/brand/logos/docked-primary-on-dark.png` for dark header/sidebar; the existing `BrandLogo` map for official profile marks and light surfaces; unchanged production app-icon/splash/favicon/OpenGraph assets. No logo was redrawn or generated.

## Visual review

The five-tab hierarchy, compact top bar, navy surfaces, white Edge/feed cards and blue controls follow the supplied reference. Feed heading excess was removed after screenshot comparison; its first card starts near the top rather than below a marketing-style heading. Following puts discovery immediately after an empty circle. Points retains its dashboard hierarchy without fabricated numbers. My Edge prioritises identity, a compact record and account rows. Desktop sidebar scrolling and social-image disclosure target size were corrected after accessibility failures. Screenshot fixtures remain conspicuously labelled and never enter application data.

## Validation and delivery

The implementation is committed on `codex/docked-value-platform`: `bdef279` adds the mobile experience and `6cd1661` fixes the populated discovery row found during genuine hosted acceptance. The deployed web source is `6cd166187c30596d3f97d793606a2398adf6f43c`.

| Local check | Observed result |
| --- | --- |
| Type checking and lint | PASS |
| Production web build | PASS |
| Platform / authentication / security regression suite | 195 passed, 0 failed |
| PostgreSQL-compatible PGlite / RLS suite | 82 passed, 0 failed |
| Browser regression coverage | All 60 distinct cases have passing evidence; final full run: 59 passed, 1 timeout; the unchanged isolated rerun passed. Includes 13 new mobile cases. |
| Dependency audit | 0 known vulnerabilities |
| Client secret scan | Final build: 50 files / 1,708,400 bytes; 0 findings or errors |

[Validation receipt](validation.json) and [final browser results](browser-final-results.json) record the scope. Responsive checks cover 320–1920 CSS pixels, light/dark OS preferences, keyboard access, mobile insets/occlusion, long content, empty/restricted/error states, direct routes, refresh, card outcomes/corrections and timeline authorization. Axe WCAG A/AA checks and browser console checks pass in the completed cases. The initial complete run passed all 56 cases; four populated-member cases were then added. In the final 60-case run, one 320-pixel public case timed out waiting for `/community` network idle. Its unchanged [isolated rerun](brand320-rerun.json) passed all 12 routes in 38.4 seconds. Both results and the original diagnostic trace are preserved; the timeout's underlying cause remains unconfirmed. This is not represented as an initially green full run. Two earlier sandboxed runs were interrupted after stalls and are not counted as completed runs.

[Docked Preview](https://docked-preview-s24-briant-ginty.vercel.app/edges) now serves the exact reviewed web source at deployment `dpl_J6UfdR9DPMx5YSkLjk93LHcPP1gn`. The [final source audit](deployment-source-final-audit.json) verifies all 338 exported files against the dry-run hashes. The [hosting audit](hosting-audit.json) verifies the dedicated project/alias, 27 Preview variables, zero production variables/deployments, connected Preview database, unconfigured providers and paused publication. No production deployment or DNS change was made.

[Android v4 APK](../../../artifacts/android/Docked-Preview-S24-v4-Mobile-App.apk): versionCode **4**, versionName **1.3-preview**, **9,262,110 bytes**, SHA-256 `18fb07bcb4f1fc8d43ac1b1b9c974b56f902ec0a76e2ff4f53558a993af8e19e`. The [Android report](android/README.md) records the final Gradle build, signature/network/config checks, full 988-file secret scan and preserved v3 comparison. The actual v3 package/signature match supports an in-place upgrade. The first undelivered v4 candidate and its receipts were archived before rebuilding with the final deployment receipt. Physical Samsung S24 installation and native runtime acceptance remain **UNVERIFIED**: no device was attached, installed or launched.

## Genuine hosted acceptance

The [final results](hosted/2026-10-03T11-13-47-878Z/results.json) pass **15/15 views**: all five tabs at 390 × 844, 412 × 915 and 1366 × 900. Three normal password-login/secure-cookie/own-identity cycles exercised tab switching, direct refresh, restricted APIs, normal global logout and subsequent private API denial. All views had zero Axe violations, console errors or runtime errors. No identity injection or fixture response was used for these checks.

The one explicitly labelled disposable private QA account was then erased through the existing revocation/deletion service. The [cleanup receipt](operator/cleanup.json) verifies that only the retained owner remains, owner data and credential-file fingerprints are unchanged, temporary credentials are redacted, and no sporting records, messages, delivery attempts, staff privileges or broad regional approvals were created. No schema, shared policy or provider setting was changed. Earlier incomplete/failed receipts remain available, including the actual Following contrast defect that prompted `6cd1661`.

Final genuine hosted screenshots: [Edges](hosted/2026-10-03T11-13-47-878Z/edges-412-viewport.png), [Feed](hosted/2026-10-03T11-13-47-878Z/feed-412-viewport.png), [Following](hosted/2026-10-03T11-13-47-878Z/following-412-viewport.png), [Points](hosted/2026-10-03T11-13-47-878Z/points-412-viewport.png), [My Edge](hosted/2026-10-03T11-13-47-878Z/my-edge-412-viewport.png). The captured synthetic QA identity has since been deleted. Rich feed/Edge cases use the clearly labelled isolated fixtures, not fabricated Preview records.

## Visual acceptance against the supplied reference

| Reference requirement | Implementation / evidence |
| --- | --- |
| App identity rather than website navigation | Authenticated compact shell, dedicated screens and desktop-specific sidebar |
| Dominant five-tab navigation | Exact order, icons/labels, visible blue selected state, fixed safe-area-aware bar |
| Compact top bar | Supplied on-dark wordmark and two utility actions; no promotional hero |
| Edges | Compact header/status/filters and selective white record cards; current empty/restricted state stays truthful |
| Feed | Dense social timeline with author, body, attached records and existing interaction controls |
| Following | Personal feed/discovery tabs, honest empty relationships and eligible real account suggestions |
| Points | Monthly/lifetime hierarchy and verified records; missing points/levels explicitly not enabled |
| My Edge | Identity, real relationships, record summary and compact activity/account rows |
| Consistent Docked branding | Existing assets, central navy/blue/white/grey/mint tokens; functional icons remain functional |
| Responsive separation | Website menus removed from authenticated mobile; desktop routes and broader navigation retained |

The [labelled fixture screenshots](mobile-app/) exercise rich cards, long posts and missing metrics without inserting data. Genuine hosted screenshots and disposable-account cleanup are recorded separately in [operator acceptance](OPERATOR_ACCEPTANCE.md). Browser simulation does not establish physical S24 safe-area, keyboard or native lifecycle acceptance.

## Issues corrected during this work

- Bounded timeline pagination initially sliced a partially retained final page and advanced its cursor. It now keeps complete pages and continues from the first unconsumed cursor; a 99-row boundary regression prevents skipped posts.
- Extended desktop sidebar links could push its footer beyond the dark surface. Viewport scrolling retains contrast and access.
- An existing media disclosure control fell below the accessibility target size in the denser layout. Its summary retains a 44-pixel touch target.
- Mobile missing-metric text wrapped poorly in small cards; dedicated unavailable-value sizing keeps it readable without substituting zero.
- Genuine hosted Following suggestions exposed a squeezed identity row and low-contrast official badge that the empty fixture missed. Identity and controls now have separate rows; common official identity badges retain their own contrast tokens. Four new populated-member regressions verify long names, official profiles, expanded controls and 44-pixel targets.

All of these fixes are presentation or pagination behavior. No pricing/provider rules, publication gates, corrections, RLS, authentication handlers or immutable ledger accounting were changed.

## Handoff and remaining dependencies

**Fully implemented:** the five app destinations, compact responsive shell, existing Edge/feed/community interactions, profile/account controls, honest pending states, exact native route allowlists and Android v4 packaging. Existing desktop, authentication/MFA and permanent-record workflows are preserved.

**UI scaffolded / backend future work:** points/XP/levels, persistent sport/competition follows, and genuine metrics that require unavailable data or regional approval. Licensed odds/results, strategy validation and legal approval remain prerequisites for live publication. No service credentials are needed merely to review this completed UX.

The next acceptance action is to install the linked v4 APK over v3 on the Samsung S24, sign in with the retained Preview account, and confirm the physical status/system bars, five tabs, scrolling, keyboard, back navigation and background/resume behavior. This physical check is still outstanding and is not represented by browser screenshots or APK inspection.
