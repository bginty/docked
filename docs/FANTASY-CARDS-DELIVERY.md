> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Fantasy Cards Preview V1 delivery

Branch: `pivot/fantasy-cards-preview-v1`. Preservation tag: `checkpoint/pre-fantasy-cards-preview-v1`. The exact deployed source commit and deployment ID are recorded in [deployment.json](qa/fantasy/deployment.json); later delivery commits contain documentation, evidence and native assets.

## Tester access

- Homepage: https://docked-preview-s24-briant-ginty.vercel.app/
- Login: https://docked-preview-s24-briant-ginty.vercel.app/app/login
- Member workspace: https://docked-preview-s24-briant-ginty.vercel.app/fantasy/play
- Manager: https://docked-preview-s24-briant-ginty.vercel.app/fantasy/admin
- Android: `artifacts/android/Docked-Preview-S24-v8-Fantasy-Cards.apk`, package `au.com.docked.app.preview`, versionCode 8, versionName `1.7-preview`. The final hash and security checks are in [android-audit.json](qa/fantasy/android-audit.json).

Credentials for Briant, Barry and Test Manager are saved only in the ignored local file `private-data/fantasy/tester-access.txt`. They are not in Git or deployed assets. Use separate browser profiles/incognito contexts for the three accounts. Sign in with the supplied email and password; public registration remains disabled. Access expires seven days after provisioning, with the social Preview grant expiring after six days.

The Manager must also visit `/mfa`. Add the saved authenticator setup secret to an authenticator, enter the saved Factor ID and its current six-digit code in **Verify MFA**, then open `/fantasy/admin`. The account is already enrolled; do not enrol another factor merely to sign in. MFA is enforced server-side for every privileged fantasy action.

All three testers have their Starter cards and test credits. Acceptance activity remains visible: one scored three-member round, two sales, a completed trade, a retired fictional prospect and its replacement. New testers can use the existing open Rookie League: select it under **Play**, choose a valid 1 GK / 4 DEF / 4 MID / 2 FWD eleven, and save. The Manager can create a short future round and simulate it after lock. Use **Cards** for packs and collection, **Market** for listings and card trades, **Social** for posts/reactions/comments/follows, and **Profile** for credits and history. Starter cards cannot be traded; acquire a test-credit pack for trading. Remove a card from an unresolved lineup before offering it for sale or trade.

## Shared implementation

The responsive website and existing Capacitor Android shell load the same Next.js application, authentication, APIs and isolated Supabase project `bckkllmndoxzpzdqrevb`. There is one authoritative inventory, wallet, pack allocation, lineup, result and social history. Refresh/navigation retrieves the shared state; realtime subscriptions are not implemented.

Reused: Supabase Auth/SSR and live-session checks, MFA/private roles, server database wrapper, rate limiting, same-origin validation, profile/onboarding/consent infrastructure, AppShell and native bridge, PWA public-only offline cache, existing social feed/reactions/comments/follows/privacy/moderation, and guarded Preview/Android pipelines.

New: `fantasy` schema; `src/core/fantasy.ts`, retry helper and server command wrapper; `/api/fantasy`; `/fantasy/[tab]`; collection/card/reveal/team/market/wallet/results/admin components; responsive Fantasy stylesheet; central supplied-asset map and Preview homepage.

Migration: `supabase/migrations/20261007204317_fantasy_cards_preview_v1.sql`. Additive and applied only to isolated Preview after the exact-hash dry run. Disable the Preview flag/settings to withdraw this feature; do not drop ownership or ledger history as a rollback.

## Integrity and security

All 27 fantasy tables have RLS enabled and browser-role privileges revoked. No permissive direct-client policies are supplied. Only the reviewed command/read entry points are granted to `docked_app`; internal helpers are not public. Security-definer entry points have fixed empty search paths, revalidate the live invited user/session and require actual MFA/private-role authority for administration. Production environment gates, TLS verification, registration/publication/payment guards remain.

Commands serialize on a transaction advisory lock for the three-tester scope. Card identity and serial/supply limits are immutable; transfers append provenance. Pack acquisition allocates and charges atomically, with persisted reveal outcomes. Balanced append-only journals settle test credits and the snapshotted 7.5% seller fee. Trades transfer all cards or none. Server validation and database triggers enforce formation, ownership and wall-clock locks; scored snapshots/results cannot be rewritten. Football scoring uses versioned event statistics and never uses card rarity as a multiplier.

The final read-only live reconciliation passed 13 assertions: member cap, declared supply, current owner/provenance, balanced journals, nonnegative wallets, fee totals, complete pack allocations, active listing ownership and preserved account/Edge/outbox/model baselines. See [live-integrity.json](qa/fantasy/live-integrity.json).

Supabase advisors were run. The no-policy INFO notices are expected for intentionally inaccessible internal tables, verified through ACL and denial tests. The project still reports [leaked-password protection disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); testers have generated passwords and the manager has MFA. [Unindexed foreign-key](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) notices include 26 new fantasy references: an indexing/performance follow-up before expanding beyond this three-user Preview. No unused legacy indexes were removed. Details: [advisors.json](qa/fantasy/advisors.json).

## Review configuration actually used

The main chat could not switch its own model/effort; no claim is made that it was changed to Astra Medium. The foundation review ran on Astra High. The single bounded final review used ownership/scarcity/permissions at Astra Extra High, wallet/market/trades at Astra High, and fantasy eligibility/locks/results at Astra High. Reviewers were read-only, had no nested delegation and did not change test data. Ultra was not used. No repeated whole-system audit was launched.

Actionable findings were investigated and fixed by the main agent:

| Affected files | Concrete failure scenario | Fix/regression |
|---|---|---|
| Fantasy migration, database tests | Unfunded pack reservations could consume all stock before charging | Atomic acquisition, allocation and debit; insufficient-credit and injected-failure rollback tests |
| `fantasy-screen.tsx`, `fantasy-request.ts`, platform tests | A lost committed response followed by a fresh UUID could duplicate a purchase/grant | Retain pending payload/key until its outcome is known; retry regression |
| Fantasy migration, database tests | Incomplete position configuration or an insertion crossing lock could evade expected lineup validation | Complete formation validation plus INSERT/UPDATE/DELETE wall-clock trigger tests |

Configurable duplicate-player competitions are explicitly supported by the brief; the default prohibits them. This was not treated as an unconditional security defect.

## Verification and limitations

Full database suite: **185/185 passed**. Full platform suite: **373/373 passed**, including the final branding/offline, partial-tier validation and guarded-export regressions. Counts are recorded in [test-summary.json](qa/fantasy/test-summary.json). Typecheck, lint, local optimized build and guarded hosted builds passed. The live three-user flow recorded **74 passing assertions**, resuming from saved checkpoints when fixes were needed; this includes repeated setup checks and is not a count of unique tests. **Four additional social checks** passed. See [acceptance.json](qa/fantasy/acceptance.json), [social-check.json](qa/fantasy/social-check.json) and [visual.json](qa/fantasy/visual.json). The historical `acceptance-failure.json` is retained as resolved diagnostic evidence, superseded by the passing acceptance report.

Verified browser flow: mobile pack open → desktop collection; desktop team save → mobile lineup; desktop listing → second-user mobile purchase; exact credits, ownership and provenance; simultaneous opens return one outcome; simultaneous buyers produce one winner; atomic trade; late lineup denial; three scores/championship awards; social events; retirement without loss of the card; replacement issuance/opening. Additional social checks cover post visibility, likes/comments, follows and author-only deletion.

Chromium checks cover all five tabs at **360, 390, 412, 430, 768 and 1440 CSS pixels**. The 412-width check approximates Samsung S24 layout and is not Samsung hardware testing. Thirty layout checks had no overflow or broken images; five automated WCAG checks at 390 pixels reported no violations after repairs. No browser JavaScript errors were recorded. Automated accessibility tests are not a complete manual accessibility audit.

The final deployment also passed [offline caching checks](qa/fantasy/offline.json): only the branded public fallback is cached, private screens/API data are network-only, and the supplied favicon/social metadata are selected. Homepage/login responsive landmarks and automated accessibility results are in [entry-pages.json](qa/fantasy/entry-pages.json).

Android package build and archive audit passed; debugging, cleartext and mixed content are disabled. APK installation and activity launch succeeded on a Pixel 5 emulator, with package/version confirmed, before the final receipt/offline-shell delivery rebuild. The final delivered APK was built and audited, but not reinstalled. Native interaction testing was blocked by repeated **Pixel Launcher** and **System UI isn't responding** dialogs. The emulator was stopped; no physical device was connected. Native login, native cross-client transactions, device keyboard/back behavior and Samsung S24 hardware remain unverified. The screenshot `android-launch.png` records the emulator failure and is not a successful app-screen capture.

To install, transfer the APK to the Android tester device, allow installation from that transfer/browser app when prompted, and install. Open Docked Preview and use the same tester credentials as the website. This is the existing local debug-signing pipeline with WebView inspection disabled, not a Play Store release. The preserved v7 and new v8 signing certificate SHA-256 digests match. Signing evidence is in [android-signing.txt](qa/fantasy/android-signing.txt).

Failures encountered and addressed: omitted legacy research-policy file in the first hosted export; PostgreSQL double-encoded command payloads; overly strict Zod enum records rejecting single-tier pack configurations; timestamp hydration and selector labeling; Social text contrast; duplicate main landmarks caught by final entry-page verification; stale Android receipt/branding checks and intermittent Windows writes of identical generated assets. The first manual-statistics database fixture used a past creation deadline and was corrected. An early boundary-time HTTP lock assertion did not match its expected status; the response was not captured, so its exact cause is unknown. Rechecking against the locked authoritative round returned 409, the database boundary tests pass, and scoring immutability remains enforced.

Advanced admin configuration uses validated JSON forms. There are no real sporting feeds, real player likenesses, cash payments, withdrawals, NFTs, automatic bench replacements or public release. The existing Edge implementation, original four auth accounts and model/publication history are preserved. **Production, production database and DNS were not changed.**

## Screenshots

Latest rendered evidence: [Homepage desktop](qa/fantasy/homepage-1440.png), [Homepage mobile](qa/fantasy/homepage-390.png), [tester login](qa/fantasy/login-390.png), [Play desktop](qa/fantasy/play-1440.png), [Play mobile](qa/fantasy/play-390.png), [pack opening](qa/fantasy/pack-opening-390.png), [collection](qa/fantasy/cards-1440.png), [team builder](qa/fantasy/team-builder-1440.png), [market](qa/fantasy/market-1440.png), [social](qa/fantasy/social-390.png), [profile](qa/fantasy/profile-390.png), [offline fallback](qa/fantasy/offline-390.png). Brand provenance and mapping: [BRAND-INTEGRATION.md](BRAND-INTEGRATION.md).
