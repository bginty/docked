# NFL live rollout — 18 October 2026 (Sydney)

## Live publication verified; second-account browser acceptance pending

Live URL: https://docked.com.au. Application commit
`39f136e5eda7ec7175b72173f24531674a808ebb`, deployment
`dpl_76yUzJmvCMtwhkpXukAyR7JhVMGG`, built from the committed web-only export,
validated without domain promotion, then promoted to the existing live domains.
The local operator lock-order correction is commit
`8d30b88ec181ef5fba93beb67cba8115d8386b47`; it does not change deployed web code.

- Full access now reaches the runtime. DNS, HTTPS, PostgreSQL TCP/authentication,
  disposable Git writes and junction/build operations passed. No bypass, security
  setting change, paid service or repeated elevation was used.
- A fresh, consistent recovery export and offline restore drill passed before
  mutation. See [recovery receipt](NFL_RECOVERY_RECEIPT.md).
- Five reviewed migrations applied, bringing the migration count from 79 to 84.
  The testing-only feed-consumer migration was not applied. Dedicated reader and
  writer credentials are private and have no account/wallet/card/competition
  mutation privileges. Signing credentials are excluded from Git and client output.
- The real service batch contains 11,475 revision events. Live storage now has
  **5,569 latest player-game records, 272 games and 1,603 players**. Every stored
  payload was compared with the retained real export. There are 74 final/available
  games, **six final/incomplete games**, and 192 scheduled/not-started games.
- **433 reviewed player mappings** and provider-verified legacy aliases published;
  **493 players** pass the official roster eligibility policy. 961 evidence records
  were incorporated. Unresolved/no-appearance players are not given invented stats.
- **Eight cards retired**, with exact allocation/ownership/history preimages and
  approval archived in the same transaction. Economy revision advanced 122 to 123.
  All 324 immutable issued allocations remain; 316 active economy cards remain.
  The 51 legacy Core-card rows and all other covered dependency tables are unchanged.
  Accounts, balances, eligible instances, pack receipts, serial scarcity and
  competition rules/results were preserved.
- An independent weighted calculation matched **1,673 mapped player-weeks** and
  season totals. Full-PPR lost-fumble deduction is applied once. History does not
  award competition points, activate rewards or run settlement.
- Identical signed bytes were delivered twice successfully. The second delivery
  kept the same generation, records hash, audit hash/count, scores and last-success
  time. A forged signature was rejected (HTTP 422) with no data change.
- On the actual signed-in live owner screen, Aaron Jones shows Week 5 **18.70**,
  Ultra Rare reference **24.31**, season **70.20**; raw Week 5 data includes 113
  rushing yards, one rushing TD, three receptions, four receiving yards and one
  lost fumble. Will Howard shows **Missing data / —**, not a fabricated zero.
- Ordinary-member admission/gameplay gates are enabled for the existing member,
  and the history handler has no owner-role check. **Barry's separate browser
  acceptance remains pending**; the user was asked to sign in using the existing
  account. Physical Samsung acceptance has not been performed.

Evidence is retained privately in `private-data/nfl-live-release/`, including
candidate/promotion receipts, exact compressed source batch, before/after duplicate
comparisons and live screenshots. No credentials or account data are published.

Two failures were diagnosed and resolved: the first import rolled back its page
because the PostgreSQL adapter encoded already-serialized JSON twice; a full real
batch passed in a forced-rollback transaction after correction. The first cleanup
rolled back on a deadlock with `sports_feed.nfl_lock_due()`. The operator now takes
the existing marketplace advisory lock before dependency table locks, matching the
app's order. A fresh guarded run then committed the eight approved retirements.

### Live Samsung checks

1. Open https://docked.com.au/fantasy/cards and choose **Update app** if offered.
   Sign in separately as owner and Barry in Samsung Internet/Chrome.
2. Find Aaron Jones, open the card and flip it. Check Week 5 18.70, season 70.20,
   expand Raw stats and season attribution. Carson Wentz is another database-verified
   example: Week 2 6.32, Week 1 19.22, season 25.54 (inspect if held/visible).
3. Check a six-week player's Older/Newer controls, an incomplete-game disclosure,
   and Will Howard's Missing data/— state. Missing is distinct from real zero/DNP.
4. Check portrait/landscape, large text, card scrolling, Android Back and returning
   from the background. Confirm wallet balance and eligible cards remain intact.

## Historical execution notes (superseded by live status above)

## Resumed at 12:32 UTC

The composer Full access selection now applies: the one-time runtime check passed
DNS, HTTPS, database TCP, disposable Git writes, ordinary file operations and
junction creation. The clean production build and client-boundary canary scan
passed. A consistent refreshed recovery snapshot and offline restore drill passed;
see NFL_RECOVERY_RECEIPT.md. Live candidate validation derives the same eight
approved cards, zero relational/offer dependencies, 493 eligible players and 433
verified history mappings. TypeScript and 11 focused history/retirement/batch tests
passed. Publication is in progress; the historical status below predates this run.

## Authorization and current status

The owner explicitly authorizes real NFL player history, the audited acquisition catalogue and evidence-supported retirement of ineligible test cards on live Docked. The live site is the owner/Barry test environment. Separate Preview/database and owner-only visibility requirements are superseded for this scope. No further deployment permission is required. No paid service, automated scheduler, competition settlement or financial activation is authorized.

At the earlier blocked attempt, no deployment, migrations, role changes, imports or card removals had occurred. The following historical notes describe that earlier state, not the current live release.

Connected Supabase read-only inspection confirms project `pojoymtniryarxxunyvz`, latest migration `20261016233803`, with neither `nfl_history` nor `nfl_roster` present. Vercel project remains `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST` (`docked-production`).

## Implemented and locally verified

- Dedicated signed receiver `/api/nfl/history/import`, restricted to the exact approved Production origin/project/dataset. HMAC authenticates exact bytes and endpoint audience. Real-only admission rejects synthetic records and other sources. Existing dataset, expiry, body-size, replay and transactional checkpoint protections remain.
- Additive private `nfl_history` schema, separate restricted reader/writer roles, no wallet/ownership/Auth/competition grants, immutable import audit, reviewed mapping/alias tables. Credentials and activation flags remain unconfigured; roles are created without login until secure provisioning.
- Shared importer now batches revisions and metadata into database transactions instead of issuing thousands of per-row queries. Publication reads refuse an in-progress or failed checkpoint reconciliation.
- Member-authorized card-history service and card back show raw fields, versioned base/adjusted points, weekly results, season totals, source attribution and freshness. Existing card front unchanged. Browser acceptance and broader player-profile coverage remain to be verified.
- History uses `docked-nfl-postgame-full-ppr-test-v1`: approved full-PPR rules including **−2 fumbles lost once per player**. This stable version identifier is retained; it does not replace existing competition versions. Missing required fields remain incomplete; real zero and confirmed DNP remain distinct; historical complete scores may remain visible with a stale label.
- Audited retirement migration preserves immutable serial allocation and consumed scarcity while permitting precisely archived ineligible test assets to leave active ownership. Tests reject unapproved retirement, runtime creation of approvals and resurrection. This migration does not itself retire any live cards.
- Manual command `npm run nfl:refresh` prepared. It backs up local SQLite, triggers the separate source worker and correction sweep, checks failed jobs, exports a signed batch and verifies the receipt digest. It has no listener, scheduler or purchased service. Optional empty environment overrides use safe defaults. Failed refresh does not proceed to publication.
- Build secret-canary checks now include the new history reader/writer and signing variables. A successful build/client scan is still outstanding.

## Real-source verification

`docs/qa/nfl-batch/local-proof.json` is the machine-readable receipt. It uses the existing separate `docked-nfl-ingestion` nflverse adapter, with no paid data subscription and no upstream fetch during this proof.

| Check | Observed result |
| --- | --- |
| Dataset | `a78ff31f-6f3f-4ac6-9d45-34208626e325` |
| Revision events | 11,475 |
| Current player-game records | 5,569 |
| Game metadata | 272 |
| Feed players | 1,603 |
| Reviewed eligible mappings | 433 |
| Incomplete games | 6 retained |
| Real sample | Aaron Jones, canonical `p_1db0a980ad2945efaffc33011b2c8a06` |
| Sample game | `g_82ac02d645854a498c0f06d6eb343418` |
| Independent / engine score | 18.70 / 18.70 |
| Duplicate delivery | Entire report unchanged |
| Source SQLite / accepted recovery snapshot | Hashes unchanged |
| Hosted delivery | Not performed |

The accepted reconciliation remains 493 eligible, 433 with recorded statistical identities and 60 with no recorded appearances. Two unresolved identities and 23 reserve-review cases remain excluded from acquisition. No appearances is not zero or a matching failure. No new full roster audit was performed.

## Current live removal candidates — not executed

Current active records were joined against retained player and provider identities, rather than replaying local card IDs. The preflight found eight cards for seven players:

| Player | Decision | Current live card IDs |
| --- | --- | --- |
| Chase McLaughlin | Unsupported position | `02ada864-39a5-4935-b271-3a09359579bf`, `dea83257-2efe-43b5-afd4-5ac0366d6b1d` |
| Eddy Pineiro | Unsupported position | `4e9c092d-43f7-4b97-b225-6c95dc588fa3` |
| Harrison Mevis | Unsupported position | `5fdf6268-8607-45eb-81c9-9f03934ef2c1` |
| Jake Bates | Unsupported position | `6adfb683-728c-4fb0-842a-20de80d808c2` |
| Ka'imi Fairbairn | Unsupported position | `f1577764-b6e7-4dd0-b058-388530fb83af` |
| Ryan Miller | Confirmed released in accepted evidence | `01227a90-2deb-41d7-959d-856b2dbf2ad2` |
| Wil Lutz | Unsupported position | `7c92289b-72a5-4d31-a28f-cbf9e8b40be7` |

This is a candidate inventory, **not an executable manifest**. Current ownership, dependency records, hashes and evidence freshness must be captured again immediately before execution. No players, cards or dependent live records have been removed. Existing uncertain cards are not authorized for removal merely because matching is unresolved.

Preserve accepted snapshot `private-data/nfl-roster-audit/snapshot-1792214552985.json` (SHA-256 `7f79214ed0ae8a2db426ff7cdcec5688264d97d4803400de3de53aea2c47fb69`) and existing local removal audit. `scripts/nfl-roster-snapshot.ts --live-recovery` writes a separate `latest-live.json` pointer and has a bounded deadline; it never overwrites the accepted snapshot. The continuation produced a fresh connector-based scoped backup and passed its offline typed-row restore drill. See [recovery receipt](NFL_RECOVERY_RECEIPT.md) for exact scope and remaining recovery limitations.

## Checks and failures

- 8 focused database/import/history/retirement tests passed.
- 9 existing roster eligibility and card-history regression tests passed.
- Typecheck passed after correcting the test environment parameter type.
- Focused lint passed for the main changed files.
- Python compilation passed for exporter and manual job.
- Actual source export/import/duplicate proof passed after bulk importer changes.
- `npm run nfl:refresh -- --check` correctly refuses to start without a configured private signing key. No actual source refresh or hosted push ran.
- Isolated production build failed with Windows `EPERM` creating a node_modules junction and then `.next` build directories. Precreating directories did not complete the build. An elevated retry made no observable progress and was stopped. No final build or client-bundle scan passed.
- Direct read-only Production backup failed `ENOTFOUND`. Elevated retries made no observable progress and were stopped. Connector SQL reads work, but that does not establish a working local backup or outbound delivery path.
- No new commit. An existing zero-byte `.git/index.lock` was present; it was not removed, and the unrelated dirty tree was not staged or reset.
- No new rendered screenshots, hosted acceptance, correction simulation on Production or physical Samsung testing. Synthetic corrections remain local.

### Continuation findings

- Configured session-pooler endpoint: `aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`. The project API confirms direct host `db.pojoymtniryarxxunyvz.supabase.co`, active PG17.11 in Sydney. The saved pooler configuration is linked to this project, but its current dashboard assignment could not be independently retrieved. No endpoint was guessed or changed.
- Node DNS returns `ENOTFOUND` for the configured pooler, verified direct host and unrelated `vercel.com`; PowerShell DNS returns `Access is denied`, including unrelated provider domains. This establishes an execution-environment DNS restriction; it does not establish a bad password, stale pooler or absent direct endpoint.
- Avoiding the first dependency junction exposed Turbopack's own denied junction `.next/node_modules/sharp-20c6a5da84e2135f`. A separate Webpack attempt failed `mkdir` at `tmp/nfl-testing-build-1792231427291/.next/server/app/api/auth`. Both attempts used sanitized build environments. Temporary workaround flags were removed after diagnosis.
- Ordinary mkdir probes succeeded at the earlier failing parent. Process inspection through CIM was denied, so no claim is made that host locks are absent. No unrelated process was terminated. The managed clean-worktree operation timed out resolving Git root, and a local clone also stalled. Neither produced a usable candidate checkout.
- `.git/index.lock` has explicit sandbox deny ACEs. It was not deleted or permission-modified. An elevated read-only diagnostic stalled and was stopped; no repeated elevation attempt or security-software change was made.
- Connected GitHub confirms the remote branch is behind the accepted local work: local `8a137f68` and deployed CLI metadata commit `64c34635` are not available as remote GitHub commits. Deploying that remote branch would not validate the intended candidate. The available deployment tool lacks the staged-production `skip-domain` switch; the existing CLI staging workflow needs the unavailable local network. No incomplete candidate was promoted.
- New offline recovery drill: **38 tables / 3,743 rows / 57 primary or unique constraints / 50 foreign keys passed**. Two raw-source foreign-key dependencies remain external; Auth IDs are local dependency stubs, not an Auth backup.
- New current-live cleanup preflight derives cards from provider identity, not old card IDs: **8 cards / 7 players / 0 relational or offer dependencies**. Accounts, wallets, eligible cards and scarcity remain unchanged in the simulated transition; repeated transition is a no-op. The private preflight includes current revision and before/after hashes. Live removal count remains **0**.
- Last live read: migration `20261016233803`, economy revision `122`, economy MD5 `ac6669a64fbe2e1b7dcf69d947f6edb7`, 324 issued allocations, 4 Auth users, 25 raw source revisions. Neither new schema exists. Existing Vercel deployment remains READY and unchanged.

The smallest external prerequisite is a local execution session with working outbound DNS/HTTPS/Postgres and normal repository/build-file permissions, including Git index writes and junction creation (or a working staged Vercel CLI upload). No new production authorization or subscription is needed. Signing-key/role provisioning and the final live cleanup runner still need completion in that working session; these are implementation steps, not requests for the user to supply new accounts.

## Required completion sequence once local connectivity/build access works

### Resumed-session prerequisite check: 2026-10-17 10:12:59 UTC

Follow-up after the user selected Full access: at **2026-10-17 10:25:08 UTC**, the command runtime still failed all five DNS probes, HTTPS and pooler TCP (`ENOTFOUND`), Git temporary-file creation (`EPERM`), and NTFS junction creation (`EPERM`). Ordinary mkdir/write/rename/unlink passed. Evidence: `docs/qa/nfl-batch/session-preflight-20261017T102508Z.json`. The session continues to receive restricted-network/read-only Git policy; the UI change has not produced an unrestricted command runtime. No repeated elevation, deployment, migration, import or cleanup was attempted. Existing work and data remain preserved.

Read this status, the recovery receipt, roster reconciliation README/VERIFICATION, Docked postgame integration and separate-service integration handovers. No applicable AGENTS.md was found in the repository or checked ancestor directories. Existing tracked/untracked work was inventoried and preserved; nothing was reset, discarded or staged.

Fresh default-permission probes failed DNS for the saved session pooler, verified direct database host, `api.supabase.com`, `api.vercel.com` and `docked.com.au`. HTTPS and pooler TCP probes consequently failed `ENOTFOUND`. Ordinary build-directory mkdir/write/rename/unlink passed. An NTFS directory-junction probe failed `EPERM` on symlink creation. A uniquely named temporary-file creation inside `.git` failed `EPERM` on open; no existing Git file was touched. Evidence: `docs/qa/nfl-batch/session-preflight-20261017T101259Z.json`.

The user config already selects `[windows] sandbox = "elevated"`. The active session still has restricted networking and explicit read-only `.git` permissions, corroborated by deny ACEs. Changing Windows sandbox implementation or repeating elevated retries is not a demonstrated fix. No elevation retry, ACL alteration, security-software change or network bypass was attempted.

Supported administrative resolution: change the active permission policy, not production authorization. For a custom permission profile, enable `[permissions.<profile>.network] enabled = true`, authorize required destinations, and explicitly override `.git = "write"` under `[permissions.<profile>.filesystem.":workspace_roots"]` for this repository's workspace. Keep unrelated protected paths restricted. The administrator must also allow the build's directory-junction operations in the approved Windows execution context; no separate documented junction toggle was established. For legacy workspace-write configuration the network switch is `[sandbox_workspace_write] network_access = true`; do not mix legacy and named-profile configurations. Managed requirements can override user settings. Select the permitted profile using the composer permissions control and rerun the probes. These configuration changes were not applied by the agent.

Official references: [permission profiles](https://learn.chatgpt.com/docs/permissions), [sandbox controls](https://learn.chatgpt.com/docs/sandboxing), [Windows sandbox](https://learn.chatgpt.com/docs/windows/windows-sandbox). Approve for me routes approval requests but retains the workspace sandbox; elevated Windows setup is distinct from network/file authorization.

Connected read-only checks still show live commit `64c3463528fab5ff23885beb000e06eb0c5dd42e`, deployment `dpl_A1YNTWaqYY2dca9aJinRjPWko4bK` READY. Database migration remains `20261016233803`, economy revision 122 and MD5 `ac6669a64fbe2e1b7dcf69d947f6edb7`, 324 issued cards, neither new schema present. The economy preimage still matches the recovery snapshot; full dependency freshness must be checked immediately before a future mutation. This resumed attempt made **zero live imports, removals, migrations or deployments**. No new commit or live Samsung/player-history verification is claimed.

1. Complete and verify a current recoverable logical backup and private current-record removal/dependency manifest. Validate restoration locally. Preserve account, wallet, eligible allocation and source-stat hashes. Confirm the existing migration function definitions again before replacing any guard.
2. Apply only missing, reviewed migrations: `20261017021720_collectible_player_history`, `20261017052556_official_nfl_roster_eligibility`, `20261017054817_official_nfl_roster_pack_pools`, `20261017092746_nfl_player_history_publication`, `20261017093142_audited_nfl_test_retirements`. Do not bulk-push all pending migrations. The isolated test-feed consumer is not required for the live history schema.
3. Import only accepted roster evidence and reviewed mappings, revalidating provider identities against current live catalogue. Create verified aliases for legacy/permanent card IDs. Do not copy a local economy document over live state. Keep unreleased editions unreleased and unresolved/reserve cases excluded. Existing 72-hour evidence gates must stay truthful.
4. Complete the domain-aware live cleanup runner: lock current records, archive exact active card/ownership/history preimages and dependent records, apply only the audited transitions, retain immutable allocations, verify accounts/balances/eligible assets and all dependencies. Reserved offers or newly discovered relational dependencies require their existing cancellation/lineup workflows; no generic recursive deletion. This production runner is not yet completed or executed.
5. Provision dedicated login credentials and signing secret privately. Denial-test the writer against account, wallet, ownership, mapping and competition mutations; denial-test reader writes. Configure Production server-only environment variables using `deployment/nfl-batch/live-history.env.example`. Never print or send credentials in chat.
6. Complete production build, client-canary scan, local rendered acceptance, scoped commit and reviewed Vercel release. Leave the receiver disabled until schema/roles/bindings are verified; then enable it for the exact approved live audience only.
7. Deliver the existing real historical export, enable member history reads after successful publication, and deliver identical bytes again to prove unchanged live totals/counts. Authentication/tamper rejection can be tested without creating synthetic records. Corrections and incomplete-field simulations stay local.
8. Check owner and Barry access independently, Aaron Jones and other matched players, raw fields, weekly sums and season totals, all six incomplete flags, no-appearance and stale states. Verify acquisition and live removals, protected accounts/balances/scarcity and unchanged competition results. Record real screenshots and a deployment/commit receipt.

## Manual operation and recovery

After provisioning, put the local signing key in ignored `.env.nfl-history.local`, then run **`npm run nfl:refresh`** from Docked. The Python override is optional. The computer must be awake and online; opening the website does not run the job. One source worker at a time. Source queue failures stop delivery. Preserve the private spool and digest receipt after uncertain outcomes; exact-body retries are idempotent. No recurring job has been installed.

Rollback: disable `NFL_HISTORY_IMPORT_ENABLED` and `NFL_HISTORY_READ_ENABLED`, redeploy the previous compatible application, preserve raw history/audit/generations and private backups. Do not drop imported history or reset the database. A roster acquisition pause may be safer than making stale evidence eligible. Retired serials must never be reissued. Any reversal of cleanup requires a separately reviewed restore from exact archived records, not deletion of the audit.

## Samsung checklist — pending deployment

1. Owner and Barry sign in separately at https://docked.com.au in Samsung Internet and Chrome; neither needs owner-only access to player history.
2. Open a matched player's card, flip it, inspect raw stats, latest five weeks, older weeks, season total and multiplier labels. Confirm no front artwork changes and no horizontal overflow at portrait/landscape or large text.
3. Check real zero versus missing/DNP, six incomplete-game disclosures and stale/update-unavailable states; retry/background/return without losing scroll or trapping Android Back.
4. After an authorized manual update, verify current history refreshes, duplicate delivery does not add points, and wallet/cards/competition entries remain intact. Capture actual device/browser versions and screenshots; physical acceptance is not yet performed.
