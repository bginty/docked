# AFL and NRL parity release review

The application changes are implemented locally for review. They have **not been deployed** and the migration has **not been applied to hosted infrastructure**. The latest instruction requires deployment approval. NBA remains hidden; its data and scoring contracts are retained.

## Implemented experience

Play now uses the shared Docked shell, sport navigation, competition toggle, portrait cards and Field/List layout. AFL shows all 22 slots together: six Backs mapped to DEF, eight Midfielders, two Rucks and six Forwards. NRL shows WFB2, CTR2, HLF2, EDG3, MID3 and one Flex accepting all configured NRL positions. Desktop fields are bounded rather than stretched across the page; mobile prioritises readable cards and vertical scrolling.

Team names remain labels. Draft and entry controls remain separate. Changing sport, view or round does not submit an entry. Unsaved changes block sport switching; round changes require explicit discard. The picker filters authoritative owned inventory by sport, slot, search and rarity. Existing server commands continue enforcing ownership, duplicate-player restrictions, caps, reservations and round locks. Community teams were removed from AFL/NRL Play.

Rankings and Prizes now reuse the NFL components. The standings adapter preserves exact snapshot slots, card IDs, authoritative scores and ranks; it does not calculate a competing leaderboard. Pre-lock other-member snapshots stay private. Unconfigured season aggregation and prizes display honest empty states. No NFL results or prize quantities are copied to other sports.

Navigation preserves sport and valid competition context between Play, Cards, Market, Social, Rankings, Prizes and packs. Sport changes remove incompatible competition/series/round filters. Responses are checked against their sport and stale requests are discarded.

Social now has separate NFL, AFL and NRL feeds using the existing post, follow, comment, attachment and moderation services. The composer names its destination and accepts only same-sport owned cards. Global official announcements remain one canonical publication, displayed once in each sport. Historical posts with reliable card evidence gain a sport; ambiguous or conflicting records enter a review table. Conflicting attachments are excluded from sport feeds, while original posts, comments, reactions and moderation history remain intact.

## Packs and weekly rewards

The weekly starter panel moves from Profile into Buy Packs beneath Standard, and remains accessible in My Packs/history. Existing NFL entitlement IDs, receipts and schedule anchors remain unchanged.

AFL/NRL programmes start **disabled**. Once approved and enabled, the first eligible server reconciliation establishes each account/sport anchor and issues period zero. Subsequent periods are exactly 604,800 seconds apart. Opening never resets the anchor. Missed periods accumulate, with a bounded 500-period catch-up per reconciliation and continuation on a later worker run. Each programme has independent eligibility and countdowns. Issued unopened packs remain recorded. A shared advisory lock, account/sport/period uniqueness, locked pack row and request ledger protect concurrent retries.

AFL/NRL starter receipts own four random Core cards from that sport's existing source-backed beta catalogue. They are non-permanent, non-transferable, unlimited Core inventory, shown in My Cards and usable by the existing owned-card lineup path. No credit charge, limited serial consumption or permanent issuance occurs. A pool with fewer than four verified eligible players fails opening atomically and leaves the pack unopened.

The pack engine prepares all six products per visible sport: Premium 9/3/1 at 5,000/1,900/700 credits and Standard 9/3/1 at 700/300/100. Premium weights remain Ultra Rare 90%, Legendary 9.9%, Icon 0.1%; Standard remains Rare 85%, Elite 12%, Ultra Rare 2.5%, Legendary 0.49%, Icon 0.01%. These are the existing NFL per-card configuration. Core is excluded. Existing supply failure policy, transaction/idempotency service, wallet and explicit coupon product eligibility remain in force. Registration of additional AFL/NRL variants is a separate reviewed configuration action; the UI does not activate them.

## Shared implementation

Reused AppShell/SportProvider, CompetitionSwitch, SevenField, CollectibleFace/Viewer, CompetitionResults, GameDaySummary, PrizesPage, the existing sandbox lineup commands, scoring journals, SocialHome/Timeline/Composer, canonical announcements, PackShop/PackOpening and the existing weekly entitlement worker. No parallel wallet, scoring engine, player catalogue or social system was introduced.

## Verification

- Platform suite: 610 tests passed.
- Database regression suite: 217 passed, including historical Social classification and independent weekly entitlements. The final run used serial execution after Windows exhausted process-spawn resources in a parallel rerun.
- Historical Social migration test: passed for both private schemas, including reliable classification, ambiguous review, preserved comments/reactions and rejected mismatched attachments.
- Real isolated PostgreSQL: six concurrent issuance requests and six opening requests per sport passed; one pack/receipt per period, unchanged NFL receipts and no wallet charge.
- Browser acceptance: AFL22 and NRL13 at 412×915 and 1440×915; owned-only pickers, search empty state, save/reload, Field/List, Rankings team viewer, Prizes and no horizontal page overflow. Captures include empty/populated formations; additional rarity/locked-state evidence is saved in the same folders.
- NFL/AFL/NRL packs at mobile and desktop sizes: six visible products, price confirmation, nine-card purchase/open, sport-correct non-Core results, repeated-tap protection and no page errors. All variants also have automated quantity, price and pool checks.
- Navigation/Social browser: hidden NBA, sport persistence, separate feeds, account-wide Following scoped by sport, one canonical announcement per feed, unsent composer guard, lazy card attachment loading and existing community interactions. Mobile run includes 4× CPU throttling.
- Production build and canary browser-secret scan passed. Typecheck, lint and client-boundary checks passed; exact final results are recorded in `qa/three-sport-parity/validation.json`.
- Repository-wide credential-pattern scan reported eight existing files, all byte-equivalent to HEAD after line-ending normalisation. No changed file was flagged. This is not a clean repository-wide security result; filenames and baseline comparison are recorded in `secrets-audit.json` for separate review.

All mutations used isolated fixtures and local databases. No signed-in Production acceptance, hosted cron execution, new hosted migration or actual member transaction is claimed. Local screenshots do not establish physical Samsung-device performance or authenticated hosted success.

## Required release actions

1. Review `qa/three-sport-parity/release-plan.json` and migration `20261023092404_sport_social_and_pack_entitlements.sql`. Reconfirm target project, current migration history and application role. This migration sorts before the already-existing NBA rarity migration; apply only the reviewed missing migration, not a blind bulk push or replay of historical files.
2. Capture a protected recovery snapshot of weekly schedules/packs/job history, both Social namespaces and their dependent comment/reaction/audit tables, affected function definitions, credits state/product registry, ownership and competition records. Verify readback and current Supabase recovery availability. No fresh hosted backup was performed during this local task.
3. Rehearse against a disposable copy of the actual target schema. Check old NFL anchors/IDs/receipts and balances before/after, review the historical-post classification report, inspect index/query plans, and confirm function signatures/grants. Run the migration transactionally before deploying application routes that call its new overloads.
4. Register the additional AFL/NRL 1/3-card variants through the existing catalogue/configuration transaction. Compare current stored terms with the plan; preserve existing 9-card versions, purchases, balances, instances and active gates. Do not run the older broad roster-release script as a shortcut: it includes unrelated enrolment/activation work.
5. Deploy the reviewed application to the existing private beta only after approval. Preserve closed registration, admission/MFA and NBA hiding. Do not enable commercial feeds, permanent issuance, awards or unrelated financial features.
6. Separately enable AFL/NRL `weekly_sport_programmes` with the approval note and enabled timestamp. Retain `DOCKED_WEEKLY_CORE_ENABLED` and existing NFL control/settings. Inspect the existing `docked-weekly-core-entitlements` cron before changing it; it calls the same `sports_feed.weekly_core_job()` wrapper. The repository scheduler script creates an inactive job and must not be blindly rerun over a live schedule. Verify actual cron run details and worker audits after approved activation. No second scheduler is needed.
7. Perform authenticated owner acceptance: each sport's My Cards, owned picker, draft/entry, rankings, prizes, starter pack eligibility/history and safe test pack flows. Compare protected NFL/account records again. Real-member purchases, posts, grants and entries are outside the mutation-test procedure requested here.

## Recovery

Pause the new AFL/NRL programme rows and new product availability first if needed; preserve every issued pack and receipt. Revert the application to the previous reviewed deployment while retaining the extended schema and audit history. Old NFL function signatures are retained for this purpose. Do not shrink the composite keys or delete new records as rollback. Restore affected function definitions only through a reviewed forward repair, preserving their sport filters. Keep NFL's existing scheduler/control enabled unless an independently verified NFL defect requires a separate response.

## Configuration and acceptance gaps

| Area | Current position |
| --- | --- |
| AFL Traditional | Existing test cap 2,640 QA units; 22 Core cards cost 2,200 units. No approved dollar cap. |
| NRL Traditional | Existing test cap 1,560 QA units; 13 Core cards cost 1,300 units. No approved dollar cap. |
| All-Star | No salary cap; sport/ownership/position/uniqueness rules retained. |
| Prizes | AFL/NRL unconfigured; no awards enabled. NFL unchanged. |
| Season standings | AFL/NRL aggregation policy unconfigured; no invented season totals. |
| Statistics | Existing verified/provisional journal projections only. Missing data stays unresolved; no fabricated scores or historical rewrites. |
| Release | Local implementation/test evidence ready; hosted migration, product registration, programme activation and deployment require review/approval. |

Screenshots and machine-readable results are under `docs/qa/three-sport-parity/`. Existing user accounts, wallets, ownership, serials, pack history, NFL scoring and historical results were not mutated by this task.
