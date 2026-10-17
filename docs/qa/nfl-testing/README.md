# Local NFL feed acceptance — 17 October 2026

See `../../NFL_POSTGAME_TEST_INTEGRATION.md` for configuration, commands, migration scope, policy and hosting requirements.

## Final evidence

- Real separate-service API over authenticated loopback HTTP, backed by a read-only copy of its actual saved database: 5,569 records; 80 imported final games, six incomplete. Original source hash unchanged.
- Final identity check: 433 exact matches from 498 existing Docked player identities exported with read-only SQL. 56 absent feed identities and nine position conflicts quarantined. Only the disposable local consumer was written.
- Imported Carson Wentz: 6.32 in week 2, 19.22 in week 1, 25.54 observed season total. Raw game/weekly/season fields reconcile.
- Recorded local seven-card lineup with real Docked IDs: 33.64; simulated +1 reception: 34.64; explicit resync: 33.64. Replaying the same data creates no additional journal revision. Frozen entry unchanged.
- Platform suite: **450 passed**, zero failed/skipped.
- Database suite: **176 passed**, zero failed/skipped. Includes wallet/ownership, authorisation, privacy and existing scoring regressions.
- Final targeted integration rerun: **5 passed** (subset of the suites), including transaction rollback, durable cursor, duplicate/older revisions, tombstones, epoch replacement, reviewer gates, game-level incompleteness and failed-metadata handling.
- Full typecheck and lint passed. Clean local production-mode build passed. Secret-canary boundary check passed for **64 browser assets**, including the NFL reader-key canary.
- Actual owner component rendered at 1440, 1024, 412 and 360 pixels: no page overflow, zero WCAG A/AA Axe findings in tested views; keyboard-accessible selectors, long-history trend and results scroll areas. Empty and stale variants inspected separately.

## Screenshots

| View                           | Artifact            |
| ------------------------------ | ------------------- |
| Desktop                        | `postgame-1440.png` |
| Tablet                         | `postgame-1024.png` |
| Mobile                         | `postgame-412.png`  |
| Narrow mobile                  | `postgame-360.png`  |
| Awaiting import/mappings       | `awaiting-412.png`  |
| Failed sync / retained history | `stale-412.png`     |

Screenshots use the real imported baseline in the actual owner component. Empty/stale states are isolated UI variants. This is **not** hosted authenticated browser, APK, Samsung Internet or physical Samsung acceptance.

## Failures and repairs

Initial targeted testing exposed a changing completion-observation timestamp on corrections. The reconciler now preserves the original timestamp, and existing correction/reviewer tests pass. An early test also queried the wrong journal property (`points` instead of `centipoints`); that assertion was corrected without changing scoring behaviour.

Initial browser attempts found an exact accessible-label mismatch and an Axe browser-context harness issue. After correcting those, actual contrast and keyboard access defects were found and fixed. Mobile history text now wraps rather than clipping. The retained `*-failure.txt` and `axe-before-fix.json` files distinguish those failures from the final successful runs. One final lint escalation timed out during automatic approval review; the same local check succeeded without escalation.

## Scope limits

No hosted ingestion, deployment, production mutation, real entry creation or asset/wallet mutation occurred. Read-only hosted queries were limited to schema and existing NFL player identity metadata. The prepared migration was applied only in disposable PGlite test databases.

`localhost:8080` was unavailable at the initial check; the harness launched the actual separate API on temporary loopback with its own snapshot and temporary credentials. It was shut down afterward. A permanent Preview connection still needs an approved reachable HTTPS feed and isolated database binding. No tunnel, public exposure of the owner's PC or hosting purchase was created. Source identity resolution remains outstanding for six anonymous rows, and the 65 catalogue mapping exceptions remain quarantined.

The repository contains unrelated historical changes and evidence. Only the NFL integration files and this evidence directory belong to this handover; no repository-wide secret-scan claim is made.
