# NFL rarity member-round integration — 12 October 2026

This supersedes the v21 report's unfinished member-round bridge. Deployment evidence is in `qa/rarity-round`; final domain/APK receipts are added after acceptance. Six-rarity packs remain test settings, no real-money activation.

## Entry and scoring

`NFL Week 6 · RARITY TEST · no prizes`, competition `8841bf7d-5952-47c4-b926-40b04fdc5cba`, is an opt-in isolated nonwithdrawable test competition. Fourteen future fixtures; whole round locks **16 October 2026 11:15am Australia/Sydney (00:15Z)**, SEA at DEN. Sources: nflverse `nfldata/data/games.csv` and official NFL Week 6 schedule. No retrospective member entries.

Opened test-wallet cards and existing free Core cards are eligible subject to active/fresh roster, mapped fixture, ownership, unlisted state and formation: QB, 2 RB, 2 WR, TE, RB/WR/TE FLEX. K is collectible only. Canonical provider mapping prevents Core/limited aliases of one player bypassing duplicate restrictions. Human accounts were inspected read-only: both admitted with sufficient Core coverage; no purchases, grants, opening, teams or trades performed for either.

Saving a team reserves selected cards. Replace and save before selling/swapping prior to deadline. After deadline, transfers are blocked until reviewed round finalisation. Later transfers cannot change saved identity, rarity, multiplier, rules or points. This follows the existing unsettled-entry reservation policy. Shared transaction lock serialises lineup submission and wallet ownership transfer; DB trigger also rejects any other aggregate ownership update.

Locked `docked-nfl-rarity-test-v1`: complete base statistical score × frozen rarity multiplier, including negative totals. Integer tenths/centipoints; round once per player per round to two decimals, ties away from zero. Core 1.0, Rare 1.1, Elite 1.2, Ultra Rare 1.3, Legendary 1.4, Icon 1.5. Old equal-scoring competitions stay unchanged. Free and weighted season totals stay separate.

Existing source schedules, completion observation + six-hour delay, cooldowns, retained revisions, conflict/missing-stat handling and reviewed finalisation continue. Missing statistics remain pending. Updated worker attaches locked entries to the same durable scoring journal and member results read path. Idle reconciliation is not a fresh download or completed member round.

## Evidence

- Full platform: 307 passes; database/RLS: 150 passes; targeted formation/rarity: 4 passes. Typecheck/lint and production build passed. Browser/domain release checks separately recorded.
- Hosted rollback-only two ordinary AAL1 users: secure nine-card purchase, idempotent debit/open, save/reopen, ownership rejection, alias duplicate rejection, deadline lock, imported historical statistics, weighted player/team results and standings, appended synthetic correction preserving original snapshots. Real account/inventory fingerprints unchanged.
- Replay uses retained actual ATL/PIT match statistics and explicitly synthetic test lineups/correction. It is not a completed genuine member round, does not award rewards, and rolls back.
- New future-round scores remain pending until games occur and authorised source results arrive. No fabricated points or retrospective entries.
- Supabase advisor: existing private default-deny RLS-without-policy INFO findings; existing leaked-password protection warning. No auth settings changed.
- Owner MFA and ordinary AAL1 login preserved; physical S24 and owner visual acceptance pending.

## Migration and rollback

Additive migrations `20261012120429` and `20261012123000`; no supply, holdings, historical entries or grants rewritten. Second mapping fix explicitly approved after rollback proof. Old free command/read functions retained as `*_before_rarity`; helper functions private. Do not remove migration records, reset databases, or rewrite locked results.

If web regression occurs, restore prior deployment recorded in `qa/rarity-round/rollback.json`. Keep additive database functions: they safely delegate old free commands and preserve new entries. Any emergency closure requires an audited competition action; never rewrite locked results. Existing v21 points at docked.com.au and receives hosted fixes. New v22 retains package/signature.

No payments, withdrawals, subscriptions, invitations or messages. No source schedule/cooldown or DNS/email changes.

## Released and checked

- Web `dee17493f649367ab3c5e52c32997e4a361781f1`, deployment `dpl_9vbR1NvyXYfzg7uKF21wvbfJJjJn`, https://docked.com.au. Prior rollback target `dpl_ENERamnh5GPK7SXqJCsvCBhpZp2p`.
- Direct entry: https://docked.com.au/fantasy/play?competition=8841bf7d-5952-47c4-b926-40b04fdc5cba . Saving enters the selected round; no separate paid entry. Both owner and Barry have 10 existing Core cards, nine currently round-eligible, and sufficient QB/RB/WR/TE coverage. Neither has an opened limited pack as of the read-only check. No additional grants were issued.
- Hosted candidate and live-domain browser acceptance passed: ordinary password login; no member MFA; seven owned cards including purchased limited cards; save/reopen identical IDs; direct competition; mobile/desktop; axe zero violations; no console errors; private/owner API denial. Dedicated QA entry was removed before lock and its original admission restored, with audit history retained.
- Fifteen domain/HTTPS/callback/admission checks passed. Existing native bridge regression passed; owner verified factor retained, MFA required, no outstanding consent renewal at the check. This is browser native-bridge simulation, not emulator or physical-device acceptance.
- Local browser regressions: NFL team flow 1/1; scoring views at 320/390/1366px 3/3. Android Gradle build passed. v22 code 22 / `1.21-beta`, same `au.com.docked.app.preview` and signing certificate as v21, non-debuggable, HTTPS-only. APK audit 988 entries with no findings; source/browser/APK known-secret scan 1,494 files / 36.5MB with no findings.
- General repository heuristic secret scan still flags eight pre-existing items (test credential literals and an untracked v20 delivery note). No new release artifact is implicated; the unrelated v20 note remains untouched and uncommitted. This broad heuristic is not reported as passing.
- APK `artifacts/android/Docked-v22-NFL-Friends-Beta.apk`, SHA256 `303ab8e368791b518a23e1c1072f03054db6dbe39465c06aa3fb817889ee62bc`. Existing private bucket, unauthenticated signed download verified, expiry 19 October 2026 12:43:59Z (23:43:59 Sydney). Download token remains in ignored private delivery receipt, never in Git/APK.
- v21 loads the same accepted domain and receives this release on reopen; APK update is optional for these hosted changes. v22 installs as Update without uninstalling or clearing data. No human acceptance claimed.

### Member steps

1. Open Test wallet from Profile, buy Standard or Premium using existing test credits, then open the pack. Current prices/weights remain test-only.
2. Open the direct competition above (or choose `NFL Week 6 · RARITY TEST · no prizes` in Play).
3. Select QB, 2 RB, 2 WR, TE and FLEX from opened owned cards. Core can fill gaps at 1.0×. Save Team before the deadline; reopen to confirm. Listed, unmapped, inactive, stale and bye-week players cannot be selected. Only one real player across all tiers.
4. After games and collection, use View Points / post-game breakdowns / NFL standings. Pending is not zero; provisional is not final. Follow the displayed reservation policy before trading.

### Still awaiting observation

No genuine Week 6 member results exist yet. Latest authenticated worker check was idle reconciliation, not a source download. Existing unattended jobs and finalisation review remain in place; actual future-round operation is still to be observed. Physical S24/owner visual acceptance remains pending. No outstanding external purchase/permission is needed to enter this isolated round.
