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
