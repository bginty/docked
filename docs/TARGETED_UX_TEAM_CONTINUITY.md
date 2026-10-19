# Targeted UX and weekly team continuity

20 October 2026 (Sydney). Baseline: `bd12aa95e69cea0f82de3b4021202ab78a429d71`. This release is local and has not changed Production. The previous live release and Week 7 activation are documented in `PREMIUM_UX_LIVE_WEEK7.md`.

## Existing functionality retained and verified

- Canonical pack reveals are already centred: measured horizontal offset **0 px before and after** at 1536, 1440, 1024, 412 and 360 px. All six rarities, animated Next/Skip, reduced motion, short screens and scroll restoration passed. No replacement card artwork or reveal system was introduced.
- Compact Light Sweep loading already replaces blank route panels. Its shared implementation remains in use.
- The themed week selector, independent future drafts, historical entry snapshots (including cards no longer owned), scores/rank display, salary-cap optimisation and lockout rules already exist.
- Completed marketplace acquisitions already show the purchased card, rarity effects, receipt amount, collection link, Continue Browsing and immediate close. Existing settlement/ownership validation and replay protections remain unchanged. Pending/failed purchases do not qualify for this celebration.

## Changes

**First team:** Auto Select is available until the member first confirms an entry in that sport/mode. Preview, Apply and Save Draft do not count as entry confirmation. Traditional and All-Star are independent. The API and recommendation function enforce the same rule as the UI. Immutable entry history preserves confirmation after withdrawal and across seasons.

**Carry-forward drafts:** new migration `20261019213437_weekly_team_continuity.sql` reconciles eligible available future rounds when the authenticated account state loads. It reuses `seven_command('seven_draft', ...)`; it does not submit entries, reserve cards, buy cards or change ownership. It retains card instances and positions from the preceding confirmed entry or saved plan in the same chain. Existing future drafts/entries are never overwritten. Missing, listed, started or otherwise ineligible cards leave explained gaps; no optimisation, substitution or automatic filling occurs. New acquisitions remain manual choices.

The private rollover record identifies source/target, selections, omitted positions and creation time. Existing command audit, revision checks and transaction lock are reused. An audit failure rolls back the whole operation. Repeated reads and migration execution do not duplicate drafts. RLS and revoked table/function grants prevent direct member access. No other member's draft is returned. NFL is implemented against the active seven-slot system; EPL weekly competitions are not currently supported and were not fabricated.

Unsaved browser plans survive creation of an automatic draft: only an untouched first rollover revision can be adopted without replacing the local selections. A subsequent saved edit still requires normal revision conflict handling. Manual substitution of one QB was verified without changing the other six slots or Week 6.

**Navigation:** a persistent authenticated fantasy layout keeps the shell and wallet provider mounted. Background wallet refresh retains the last confirmed balance with an explicit refresh label; 401/403 clears it, and temporary network failure preserves the last value and content. Each page/API retains its existing authentication and MFA checks. Identity lookup remains request-deduplicated. Jersey metadata reads now request owned player IDs rather than returning the entire catalogue; no database latency improvement is claimed for that filter.

## Measured performance

Five alternating local browser trials used real components, an 80 ms route response and a 250 ms wallet response. These are controlled test latencies, never artificial application delays.

| Measurement | Previous shell | Persistent shell |
|---|---:|---:|
| Wallet requests per route transition | 2 | 1 |
| Median period without a balance | 418 ms | 0 ms |
| Median route content ready | 218 ms | 199 ms |
| Shell DOM retained | No | Yes |

The reliable improvement is removing redundant wallet work and balance flicker. The small route-time difference is not evidence of faster hosted database/authentication responses. No authenticated Production timing or physical Android device result is claimed.

## Verification

- 24 affected platform tests passed: Auto Select optimisation/eligibility, NFL lineups, pack recovery, completed acquisition validation, marketplace and auth recovery.
- 11 database regression tests passed: seven-slot locks/privacy/cap, marketplace settlement, weekly packs and continuity. The expanded continuity test also passed separately, covering rollback on audit failure, retry, runtime read wrapper/grants, mode isolation, withdrawal and repeated migrations.
- Browser suite passed at five widths; separate 360 × 600 short-screen check; all rarities; future draft/manual substitution; first confirmation; historical snapshot/points; reduced motion; Next/Skip; collection deep link and close. Serious/critical axe checks passed with colour-contrast excluded; this is not a full WCAG certification.
- Five-trial navigation comparison passed, including 503 retention, 401 clearing and successful refresh recovery.
- Typecheck, lint, clean webpack Production build and secret-canary client-boundary scan passed. See retained logs.

Initial test runs required fixture corrections: unsupported prize label, QB/QB1 locator, missing fake-API HTTP error status, tsx callback shim, omitted fixture stylesheet and one unused test argument. These were corrected and the affected checks rerun; the final passes are not described as uninterrupted. PGlite serialises calls: repeated/overlapping invocation tests plus advisory-lock inspection are not a hosted multi-connection stress test.

## Screenshots and evidence

All screenshots use actual components with clearly isolated test cards/data. They are not live member transactions.

| View | Before | After |
|---|---|---|
| Reveal, 412 px | [Before](qa/team-continuity/accepted/reveal-before-412.png) | [After](qa/team-continuity/accepted/reveal-after-412.png) |
| Branded loading, 412 px | [Before](qa/team-continuity/accepted/loading-before-412.png) | [After](qa/team-continuity/accepted/loading-after-412.png) |
| Shell, 412 px | [Before](qa/team-continuity/accepted/navigation-before-412.png) | [After](qa/team-continuity/accepted/navigation-after-412.png) |

[Week 7 draft](qa/team-continuity/accepted/future-draft-412.png) · [Historical team](qa/team-continuity/accepted/historical-412.png) · [First team confirmed](qa/team-continuity/accepted/first-team-confirmed-412.png) · [Purchase celebration](qa/team-continuity/accepted/celebration-412.png) · [Desktop celebration](qa/team-continuity/accepted/celebration-1536.png) · [Test results](qa/team-continuity/accepted/summary.json)

## Release and recovery

The migration is additive and tested locally. Applying it enables draft reconciliation on subsequent authenticated reads; there is no deployment-time backfill or asset issuance. Before hosted activation, review/apply this migration to an approved isolated database, deploy the matching web source and verify separate authenticated accounts, MFA, locks and retry there. Retain existing drafts and audits during recovery; do not delete drafts that members may have edited. If rollback is required, restore the prior application and read-function definition while retaining the additive table and existing data.

**Protected Preview is not deployed.** `prepare-hosted-preview.mjs` pins older reviewed branches; `private-preview-deploy.mjs` disables gameplay for the existing private Preview. `config/nfl-hosted-testing.json` also has `approved: false` and no database binding. No branch spoofing, target guard changes, Production credentials or member data were used to bypass these controls. The feature-capable isolated Preview target/branch/database contract must be approved/configured before hosted acceptance can proceed. No new URL is claimed.

Production deployment, new migration application and resulting member draft activation remain unapplied. Existing live Week 7 and marketplace data were not modified. Physical Samsung/installed Android acceptance and authenticated hosted performance remain unverified.

Changed areas: shared app shell/layout and wallet display, own-player metadata query, team continuity projection/helper/API/UI, one migration, focused database/platform/browser fixtures and this evidence. Scoring, prices, wallets, asset minting, announcements and owner routing were not changed.
