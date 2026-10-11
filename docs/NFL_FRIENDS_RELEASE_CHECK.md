> Superseded current-status summary: see [NFL_RELEASE_CURRENT](NFL_RELEASE_CURRENT.md). This report retains earlier technical evidence. Exchange/export is complete, the rc3 qualified packet is prepared, and unknown provider geography/holds are disclosed follow-up rather than automatic launch blockers. Current tests: 261/261 platform, fresh production build and hosted two-user rc3 policy/gameplay acceptance pass.

# NFL friends release — 11 October 2026 continuation

Start checkpoint: `1764911d8fb4776b79ec580ff4b19b42f8e0111f`, clean `pivot/fantasy-cards-preview-v1`; origin `https://github.com/bginty/docked.git` checked without rewriting remote work. Accepted owner login/MFA and v16 retained. No database migration, inventory mutation, invitation, password reset or MFA setup in this continuation.

## Actual status

| Area | Evidence / remaining step |
|---|---|
| Website | https://docked.com.au is HTTPS 200; www redirects to apex. Still the existing GitHub Pages holding site, **not friends gameplay**. Vercel has no custom Docked domain assigned yet. |
| Owner QA | Existing `https://docked-production-ma0j6h6we-briant-s-projects.vercel.app`, deployment `dpl_2hC7cKyP7cAChXqLfxovhPzQkhhK`, source `5ffa6eaa`. Remains protected. |
| Friends access | Closed: `friends_control.enabled=false`, `testers_enabled=false`, swaps disabled, zero tester roster slots used. Registration remains false. User's release authority is recorded; no further scope approval requested. |
| NFL collector | Function `nfl-postgame` v3 ACTIVE; platform JWT and dedicated token preserved. Task/season telemetry added so idle reconciliation is not confused with a dataset fetch. Scheduled 01:45 UTC execution succeeded and returned `idle`; no round is locked yet. |
| Source downloads | Separate weekly/PBP/roster caches retain actual prior revisions without errors. Next scheduled retrievals 11 October 12:05/12:10/12:15 UTC = 23:05/23:10/23:15 Sydney. Cooldowns untouched. One-time Codex follow-up at 23:20 Sydney reads actual outcomes. |
| Future round | Existing NFL Week 6, 14 fixtures, locks Friday 16 October 2026 11:15 am Sydney. No already-started round opened. No genuine member round completed yet; this is a post-release observation, not fabricated acceptance. |
| Email | Existing GoDaddy/Microsoft mailbox/admin identity resolved. Handler v35 now supports exact-domain callback pinning; sending remains disabled. Both functions reject unsigned HTTP requests with 401. Seven downloaded source files exactly match tested source. |
| Recovery | Domain callbacks already allowlisted. Current default Auth origin and mail pin still refer to earlier QA deployments; latest v16 callback is not allowed. Domain cutover must bind Site URL, exact callbacks and mail origin together. No recovery messages requested or accepted owner credentials changed. |
| Privacy | Exchange authenticated. Default MRM Policy, litigation hold Off, archive Disabled, no forwarding verified. Selected synthetic-message EML export passed. Effective tags/recovery period, non-litigation holds, at-rest geography and security/backup preservation still require the precise reseller confirmation in GODADDY_MAILBOX_EVIDENCE.md. No new sign-in or paid tool needed. |
| Android | No friends APK issued before domain acceptance. v16 remains owner QA, **not suitable for friends distribution**. Preserve package `au.com.docked.app.preview` and existing signing certificate, then increment beyond 16 after actual domain checks. Physical S24 and visual approval remain pending. |

The missing observation of a completed future round does not itself prevent a clearly labelled post-game beta. However, the source-job run after cooldown, policy runtime activation, domain authentication/recovery and positive admitted-member browser journey still need evidence before releasing. Historical rollback-only two-user SQL acceptance is not a real browser invitation or competitive round.

## Repairs and preparation

- `assertHostedBeta` retains protected Preview defaults. A separate explicit `DOCKED_FRIENDS_BETA=true` production path binds the exact domain/project/team and **docked_beta_app** role; it cannot activate from credentials/flags alone. `config/friends-release.json` readiness stays false, payment/prize/withdrawal/KYC and public signup flags stay false.
- `scripts/deploy-beta-staging.mjs --prepare|--deploy|--status --friends` shares the existing committed-source deployment path. It refuses incomplete readiness, uses production `--skip-domain`, and does not alter DNS. Candidate verification and domain assignment remain separate operations. No commercial role substituted.
- Mail handler accepts only an explicitly pinned `https://docked.com.au` or the existing exact QA origin; wrong protocol, lookalike domain and mismatched old callbacks remain denied. No permissions, recipient list or sending gate changed.
- `scripts/friends-cutover-preflight.mjs` reads Auth, DNS, admission and collector state; it retains the initial private Auth/DNS preimage. `scripts/observe-nfl-collector.mjs` reads due execution evidence without downloads/cooldown mutation.
- `scripts/build-friends-verification.mjs` compiles a fresh credential-free source export. The old reused local export contained retired routes absent from Git and failed; the fresh export builds successfully. That was an export problem, not restoration of old product code.

## Verified checks

- Typecheck, lint and fresh production web compilation pass.
- Final full platform run: **259/259 passed**, zero failures/skips. This includes friends target guards, beta policy/auth isolation, exact-domain mail callbacks and task telemetry. Two isolated release-export test fixtures needed their new guard dependencies included; after that repair the release-tools suite passed 3/3, guard suite 15/15 and full suite passed. No safety gate was weakened. Receipt: `docs/qa/friends-cutover/validation.json`.
- Fresh source/browser credential scan: 340 files, zero matches/errors against actual known credentials. Existing scanner separately passed 471 source files. Generic pattern scanner reports seven pre-existing test/retired fixture literals; it is not reported as a clean scan or as seven leaked credentials.
- Deployed function readback: seven files match. Unauthenticated collector and unsigned mail-hook requests denied (401); no emails sent.
- Actual scheduled reconciliation observed at 01:45:02 UTC with task and season. Source retrieval and completed-member-round statuses remain separately pending.
- Existing database/RLS, two-user rollback and Android v16 evidence is preserved, not claimed rerun here. No emulator/physical-device acceptance in this continuation.

## Exact next owner action

Domain-owner sign-in and DNS Records access are now complete and verified. All 26 visible records are captured in a private rollback snapshot; the earlier load failure is resolved. No repeat mailbox/domain login is requested. No DNS edit or support enquiry was sent. See NFL_RELEASE_CURRENT.md for the exact current technical state. Provide authorised recipient emails only when invitations are wanted; visual/S24 acceptance remains yours.

## Release sequence after factual gates

1. Reconcile and version the free-NFL policy packet using actual mailbox evidence and prior approvals; preserve historical consent bytes. Record actual readiness evidence, not placeholders.
2. Verify tonight's hosted source outcomes. Keep missing/ambiguous results pending and inspect failed runs; no download-cooldown bypass.
3. Prepare the exact committed friends candidate using the isolated beta DB role and reviewed disabled commercial flags. Preserve domain/Auth/worker rollback preimages.
4. Bind `https://docked.com.au` site URL/callbacks and exact mail origin; preserve owner sessions. Move only web DNS to current project-specific Vercel recommendations after candidate checks. Keep MX/SPF/DKIM/DMARC. Confirm no Vercel login/bypass on custom domain and test actual admitted Auth/recovery/gameplay.
5. Produce a current accepted domain receipt, increment Android version, run `npm run android:live-beta`, verify same signing identity/no privileged credentials, then publish the actual friends download and its expiry. Do not republish v16 as this build.
6. Invitations only after the owner supplies each email and explicit authorisation (up to ten lifetime testers). Australia/18+ attestation happens in onboarding; no identity-document collection. No recipients needed to finish technical preparation.

## Physical S24 review once the correct friends build is available

1. Install using **Update**, without uninstalling/clearing data; verify version and domain.
2. Sign in; ordinary tester has no forced MFA and owner/admin still does. Reopen/background and confirm session recovery.
3. Check Play/Cards/Market/Social/Profile, save a valid NFL lineup, inspect player/points pending states, and test a free swap with another authorised tester.
4. Check keyboard, Back, safe areas, offline/reconnect and no hidden controls. Scores must say post-game/provisional/final accurately; EPL unavailable.

## Rollback and cost

No web/DNS change occurred. Current holding DNS preimage: `private-data/friends-cutover/dns-before.json`; Auth preimage: `auth-before.toml` alongside it. Function rollback source saved in `private-data/friends-cutover/worker-before`: restore only the affected function with its existing authentication mode, never reset the database. Previous function versions: NFL v2 / signed mail hook v34. Vercel previous compatible protected deployment `dpl_BgcDXRpkrMMA3hDt2fmvjQCcM56S` remains available.

After future cutover, first close new admission/mutations, then restore a compatible app/holding route without deleting accounts/cards/journals. Do not undo additive schema or expose revoked functions. Reapply validated deletions before any restored data returns to active use.

Additional subscriptions/purchases: **$0**. Existing infrastructure capacity only; usage charges remain governed by current plans. No upgrades, new service agreement, invitations, paid cards, cash trading, prizes, withdrawals or KYC collection enabled.
