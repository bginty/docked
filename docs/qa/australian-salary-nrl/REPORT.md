# AFL/NRL salary correction and NRL artwork — 26 October 2026

## Audit and root cause

The approved salary configuration was already installed by migrations `20261023234740`, `20261024000314` and `20261025015440`. No duplicate salary table or replacement approved configuration was needed. Production still had all 20 AFL/NRL competition instances pointing to saved QA versions. Templates were additive; existing future rounds had not been adopted. Play selected the first round by default and showed the provisional-cap warning even for an approved Australian version.

| Requirement at audit | Classification | Resolution |
|---|---|---|
| Approved salary amounts and 13.8m/8.2m versions | COMPLETE AND VERIFIED | Reused unchanged |
| Existing future Traditional instances | INCORRECT | Adopt existing approved version for eight empty rounds |
| Historical/confirmed-entry protection | COMPLETE AND VERIFIED | Retained date, entry, draft and lock guards |
| New-round inheritance | PARTIALLY IMPLEMENTED | Before-insert adoption of approved version for eligible legacy generators |
| Default editable round | INCORRECT | Prefer next editable round; retain explicit historical links |
| Picker/budget/server validator | COMPLETE AND VERIFIED | Existing calculations use saved configuration; display warning corrected |
| Rankings/View Team/Prizes | COMPLETE AND VERIFIED | Existing snapshot calculations retained; salary subtitle clarified |
| Rules/help sport context | PARTIALLY IMPLEMENTED | AFL/NRL saved-rule salary reference added |
| AFL22/NRL13 formation, ownership, uniqueness | COMPLETE AND VERIFIED | No gameplay rule changes |
| 17 NRL reference palettes/sleeveless artwork | NOT IMPLEMENTED | Shared original panels and existing team aliases |
| Global Social | INCORRECT for latest request | No selector or sport feed filter; community/privacy permissions retained |
| Authenticated hosted browser acceptance | BLOCKED | Windows Computer Use cannot safely determine current browser URL |

## Authoritative changes

Migration `20261025234813_australian_future_salary_adoption.sql` uses a transaction, advisory lock and competition table lock. Only future, unscored Traditional rounds with no entries, drafts or slot locks change `rules.lineup_version`. It restores the original owner/MFA transition function before commit. No application transition permissions are widened. An audit event records each adopted version. Reapplication is harmless, and the release runner checks the migration history before applying it once.

Approved rarity salaries remain Core500,000; Rare600,000; Elite650,000; UltraRare700,000; Legendary800,000; Icon800,000. These are fantasy dollars, not wallet credits. All-Star remains uncapped. NFL4.4m and NBA5.2m are unchanged.

| Sport/round | Competition ID | Before cap | Approved cap |
|---|---|---:|---:|
| AFL2 | 16562955-6f6c-4333-bc3f-11f966d3e6a9 | 2,640 QA units | $13,800,000 |
| AFL3 | efbc15fb-3d17-453d-a982-94857b840930 | 2,640 QA units | $13,800,000 |
| AFL4 | 0f691556-50bb-4fc7-ae76-b5c9cc741aba | 2,640 QA units | $13,800,000 |
| AFL5 | 7f11ba84-6c44-4efc-ad09-581ff726e569 | 2,640 QA units | $13,800,000 |
| NRL2 | 227b4411-8e64-4bcb-9d19-178f4d6212bc | 1,560 QA units | $8,200,000 |
| NRL3 | 4074cd90-cabc-47e3-8694-9d2e03065e66 | 1,560 QA units | $8,200,000 |
| NRL4 | e6d34c1d-be9e-434e-a1f2-10926c09dff0 | 1,560 QA units | $8,200,000 |
| NRL5 | 3f8e6fd8-968d-4d37-830b-fba76fccf948 | 1,560 QA units | $8,200,000 |

No conversion factor is applied. All locked Round1 records remain unchanged. Existing All-Star snapshots remain unchanged. Future AFL All-Star drafts are preserved. No future Traditional confirmed entries or drafts conflict with this transition. New editable rounds created by legacy generators inherit the approved version; prize inheritance stays inactive. No prizes, entry charges or commercial features are enabled.

Play reads uncached authenticated state; configuration is selected by sport/competition/rule version. The release does not cache copied cap values. Explicit historical competition links retain old QA labels and values.

## Artwork and shared surfaces

`src/core/nrl-jerseys.ts` maps the existing stable team keys through the existing aliases: BRI, CAN, CBY, CRO, DOL, MAN, MEL, NEW, NQL, PAR, PEN, SOU, SGI, SYD, WAR, WST, GLD. `PlayerJersey` reuses shared fabric shading, trim, lighting and number rendering. Three generic panel families are original simplified artwork, without protected logos or exact kit replicas.

The same renderer serves collection, picker, lineup, details, market, pack reveals and current social attachments. Existing `preserveArtwork` snapshots keep their legacy rendering. Numbers use verified metadata only; unverified NRL shirt numbers remain blank. No universal23, new Redcliffe team, roster import, ownership or serial change. Production read-only catalogue inspection found the17 real team names plus retained fictional-test records; those old records were not deleted or reclassified.

NBA remains hidden under the earlier instruction; its data and gameplay contracts are untouched. Social is global under the latest instruction, while cards retain their sport metadata and ownership verification.

## Verification

- Platform:630 passed.
- Full database run:220 passed,3 failed due synthetic NFL fixture observations inheriting stale timestamps from a real catalogue. Corrected the synthetic fixture construction only; all6 tests in the affected file then passed. No production freshness policy changes.
- Native PostgreSQL: NFL seven-player salary/ownership/lock regression passed; separate AFL and NRL future-adoption tests passed, including idempotent rerun, saved historical rules, confirmed entries, drafts and restored permission guard.
- Salary tests: exact caps accepted;50,000 excess rejected; Core/Rare accepted; allUltra exceeds; All-Star uncapped; invalid positions, incomplete formation and duplicate players rejected. Isolated browser Auto Select creates a position-valid exact-cap lineup for both sports, then saves and confirms it.
- Browser:actual shared React components over isolated HTTP/SQL fixtures at360,412,1440px; correct defaultRound2, caps, picker, saved lineup, confirmed entry, no page overflow. All17 jerseys rendered with all6rarity frames and missing/single/double-digit examples.
- Navigation/social browser:412/1440px, persisted sport, no document reload, global Latest/Following, canonical announcement, lazy inventory, community join/leave and NBA-hidden preference recovery passed.
- Typecheck, lint, production build and client-boundary verification: see release receipts/log summary.
- Production mutations during testing: none. No purchases, awards, account changes or inventory grants.
- Hosted signed-in acceptance: not performed. Computer Use stopped because it could not establish the browser URL safely. Screenshots below are isolated local acceptance, not customer-account screenshots.

## Screenshots

- [AFL future Traditional](afl-future-412.png)
- [NRL future Traditional](nrl-future-412.png)
- [AFL salary picker](afl-picker-412.png)
- [NRL salary picker](nrl-picker-412.png)
- [NRL exact-cap populated lineup](nrl-populated-412.png)
- [All17 NRL jerseys desktop](nrl-17-jerseys-1440.png)
- [All17 NRL jerseys mobile](nrl-17-jerseys-412.png)

## Release and recovery

Production target: https://docked.com.au, existing Vercel project and Supabase `pojoymtniryarxxunyvz`. Baseline app`6e1ebc92aa096c0ab725901a0aef2bf55b74b87f`. Statistics service stays`037ae79eea582b7f1ee1ce5fbf0493120e777dc4`; no worker deployment or schedule change.

Before migration, a private recovery export was saved and read back; its SHA256 and protected-table fingerprints are in `release/recovery.json`. Full disaster recovery was not exercised. Migration applies atomically; a conflict aborts the entire transaction. Post-application checks compare all protected records and require exactly the eight listed configuration-only changes.

App rollback uses the recorded prior Vercel deployment. Keep approved salary snapshots on app rollback; do not revert entered/locked rounds to QA units. A database rollback requires renewed entry/draft/lock inspection and an explicit audited configuration transition. Do not drop historical configurations or remove migration history. No irreversible schema deletion is included.

Existing security advisor warning: leaked-password protection is disabled. It is unrelated to this release and was not changed. RLS remains enabled; private-schema no-policy findings are fail-closed informational findings.

Deployment, migration application and hosted read-only results are recorded below after execution.

## Deployed outcome

- IMPLEMENTED / TESTED / DEPLOYED: app commit `60a1a3ee966e9782cae7478b44340a3193fc3253`, promoted to https://docked.com.au on26October2026. Vercel deployment `dpl_DsxxqM39Ae7qijs2MhjeTZSzL9Vg`, candidate https://docked-production-900dyz15t-briant-s-projects.vercel.app. Live release endpoint and Vercel identity both match the commit.
- APPLIED ONCE: migration `20261025234813`, eight Traditional rounds listed above. Read-only Production verification confirms AFL Rounds2–5 at13,800,000 and NRL Rounds2–5 at8,200,000, all in `fantasy-dollars`. Round1 still has2,640/1,560 QA units. Prize text remains No cash prize.
- PRESERVED:31 protected table fingerprints unchanged after migration and after app promotion. Competition comparisons permitted only the eight planned lineup-version changes. Owner/MFA transition function restored byte-for-byte; scheduled jobs unchanged. No balances, ownership, serials, packs, historical scores, entries, locks or access flags changed.
- HOSTED CHECKS:62 candidate and62 live-domain HTTP checks passed, including release identity, closed registration, public page responses and denial of unauthenticated inventory, wallet, statistics and admin access. These are not signed-in gameplay acceptance.
- Additional rendered checks:63 route/width combinations for NFL/AFL/NRL Rankings, Prizes and Market at320/360/375/390/430/768/1440px, enlarged text, plus21 pack artwork variants passed. NRL six-product pack purchase/reveal/repeat-confirmation/Back/Refresh tests passed at412/1440px using isolated test economy and existing real-roster catalogue metadata; no Production transactions.
- Final typecheck and lint passed after the native test-adapter typing correction. Production build passed locally and on Vercel. Client-boundary scan passed for90 browser assets (not a credential-rotation or exhaustive secret audit).
- ACTIVATED: corrected approved salary rules on eligible future Traditional rounds; new NRL presentation and global Social feed. No prizes, paid entry, cash features or new data feeds activated.
- REMAINING: authenticated hosted mobile/desktop gameplay acceptance needs a safe available signed-in browser session. No confirmed-entry salary conflicts remain. Real NRL numbers remain blank where evidence is unavailable. Existing pre-release authentication advisor warning remains as documented. NBA stays hidden, pending explicit reversal of the earlier visibility instruction.

Additional screenshots: [NRL market mobile](surfaces/market-nrl-390.png), [NRL market desktop](surfaces/market-nrl-1440.png), [NRL completed pack opening](packs/nrl/completed-412.png), [Global Social mobile](navigation/social-412.png).
