# Week 6 score recovery — 20 October 2026

The card game-log read path had imported statistics while the competition worker
had not produced source snapshots. The old Edge collector exceeded its CPU
budget; its retained play-by-play cache had become stale. The website deployment
alone did not replace that scheduled worker.

Recovery uses the existing restricted `docked_nfl_worker` role and normal
append-only import pipeline. Raw statistics, entries, locked rules, rarity
multipliers, wallets and ownership are not rewritten. A fresh play-by-play
download (raw revision 38) restored explicit completed-game observations.
Thirteen fixture snapshots were imported for each seven-player Week 6 mode.

Allen's Core card now contributes 12.20 under Week 6's frozen half-PPR rules;
his Full-PPR game log remains 16.20. The owner's Traditional team has 17.60
known points. Switching Week 6 to Full PPR is not included.

The remaining opening-game failure was diagnosed as an unidentified weekly
source row (empty player ID in SEA–DEN), not a correction-window failure.
That malformed import remains blocked rather than silently discarded.

## Completed-game zero policy

The owner explicitly requested zero points for players whose games have
completed without recorded statistics during this recovery.
`nfl-completed-missing-zero-v1` implements that instruction for unfinalised NFL
imports:

- Require a valid, matching END_GAME marker and a validated, nonempty weekly
  season dataset.
- A mapped player absent from that game's records receives `assumed-zero`, with
  `stats: null`. Do not fabricate underlying statistical fields or assert DNP.
- The scoring journal records the policy and contributes zero to authoritative
  totals, rankings and completed-player counts. The UI says “Provisional zero”.
- Existing player rows with malformed stats, mismatched identity/team/position,
  or failed source validation remain pending. A completed game absent from a
  valid season dataset can receive provisional zeros while its statistics arrive.
- Reuse existing FB/HB-to-RB eligibility when matching provider positions;
  a fullback's actual valid statistics must not be lost to an exact-label check.
- Later verified player statistics replace the provisional zero through normal
  revision/correction checks. Finalised results retain reviewer protections.
- Frozen scoring weights and multipliers stay unchanged.

## Reliability

Reconciliation loads and verifies each season source once per request, then
parses the relevant game's rows. Source hashes, freshness, mapping and journal
validation remain enforced. Sources are not cached between worker invocations.
The round lease is six minutes, longer than the endpoint's five-minute limit.

The first recovery took approximately three minutes per round from the local
operator connection. Replays with reused verified sources took 26.9 and 31.0
seconds locally. A hosted candidate replay completed in 9.8 seconds including
CLI transport overhead and left the journal revision/hash unchanged.

33 focused platform tests, two isolated database tests, TypeScript and targeted
lint passed. Tests cover provisional zero, missing completion/game data,
mapping errors, subsequent corrections, idempotency, frozen scoring rules,
finalised-result protection and source reuse. Actual browser inspection was
attempted but the connected webview timed out; no physical-device acceptance
is claimed.

Production activation receipts and final verification are stored separately in
`docs/qa/score-final-live-release/`. Scheduler activation must be verified there;
this document alone does not establish that scheduled delivery occurred.
