# Multi-sport expansion — continuation and evidence

Production remains unchanged. No new live competitions, cards, packs, balances,
provider subscriptions or pricing have been created. Work is in the existing
`fixed-market-live/Docked.com.au` worktree, branch `codex/member-platform-updates`.

## AFL checkpoint

- Approved 22 slots: BACK1–6 (DEF), MID1–8, FWD1–6, RUCK1–2 (RUC).
- Existing SQL entry/draft, revision, idempotency, snapshot, lock and rollover
  implementations extended with isolated inventory/fixture adapters.
- Same canonical card renderer; original sleeveless guernsey; unknown numbers blank.
- Existing exact Auto Select now collapses equivalent-slot permutations; first
  confirmation disables subsequent automatic selection. No rarity-based ranking
  is invented; absent performance evidence remains unranked.
- `/admin/sports` and `/api/admin/sports-sandbox` require staff MFA, explicit
  sandbox allowlisting and an isolated Preview database/environment. Production
  fails closed. No automatic fixture seeding or activation.
- New migration `20261021120641_multi_sport_lineup_adapters.sql` is **local only**.
- Browser evidence in `afl/`: 360, 412, 1024, 1440, 1536; SQL-backed preview,
  apply, save, confirmation, rollover, replacement, history and community viewing.
- Database test exercises 22 selections, over-cap/incomplete/cross-sport rejection,
  original slots after transfer/removal, independent modes, revision conflicts,
  pre-lock privacy and post-lock eligible competitor visibility.
- Existing NFL seven-slot and continuity database regression passes.

## Known decisions to preserve

The repository already contains AFL scoring v1 and an owner-labelled v2 (kick 2,
handball 1, other v1 event weights retained). The 22-slot sandbox uses v2 weights
in a new version. Existing v1/v2 snapshots are unchanged. No live scoring is
enabled. The old eight-slot configuration remains available only as historical
rules data, not the new AFL lineup.

## Pending owner / provider decisions

1. Licensed provider, intended commercial use, retention/redistribution rights,
   reliable fantasy-position evidence, and credentials. Recommendation: require
   actual sample payloads and written scope before enabling ingestion. A trial
   is not permission to publish a catalogue or production scores.
2. Sport-specific Traditional salary models/caps. Test fixtures use explicitly
   artificial units; these are not prices or recommended live values.
3. New-sport scarcity allocations, nine-card paid-pack prices/probabilities and
   starter entitlement policy. Retain existing NFL products unchanged.
4. NRL proposed 13-slot format, NBA weekly-window boundaries, and each new scoring
   ruleset. Do not infer weights from a provider's fantasy-total field.
5. Protected Preview configuration and public activation. No Production deploy
   is authorised by the overnight request.

## Source readiness

Public research is reference material, not a rights grant:
- AFL position definitions and current-season reference:
  https://www.afl.com.au/news/1456989/fantasy-2026-every-player-every-position
- Provider coverage and identifiers:
  https://developer.sportradar.com/aussie-rules-football/reference/aussie-rules-overview
- Provider season-player endpoint change log:
  https://developer.sportradar.com/aussie-rules-football/reference/aussie-rules-change-log

No real player catalogue imported. No claims of real-device iOS/Android testing;
browser evidence uses Chromium at the specified dimensions.
