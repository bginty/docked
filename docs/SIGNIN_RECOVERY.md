# Sign-in / gameplay loading recovery — 15 October 2026

The user reported slow sign-in followed by “This screen could not be loaded” after the premium release. That message is the fantasy page's bounded server-read fallback, not evidence that credentials were rejected.

## Reproduced cause and mitigation

The new `current_player_jerseys` projection expanded the retained roster inside a nested loop for catalogue players. The real restricted application role could not complete the query within an eight-second statement deadline (`57014`). The earlier single-player embedded test did not expose this scale problem. Anonymous release checks also did not execute the authenticated catalogue path.

Separately, database activity showed an abandoned application transaction idle for over three minutes after `beta_fantasy.my_team_name()`, holding the shared advisory lock and blocking the scheduled NFL lock worker. This is consistent with a rendering deadline returning while the underlying transaction continued; no secret or member session was read. No authentication-provider failure was established.

The site was temporarily rolled back to `dpl_EQTfcz1qZ7HoYgLPJBgk6xRUVodn`. Only the exact observed abandoned backend was terminated after checking its role, idle state, query and age, rolling back its uncommitted work. No committed records were deleted or restored. The worker blockage cleared.

## Fix and verification

Migration `20261015102845_jersey_projection_single_pass.sql` materializes current player/source observations once per query, then joins those rows. It preserves source freshness, name/team matching, invalid/conflicting-number rejection, the view owner and existing narrow permissions. No gameplay or wallet rules change.

- Local synthetic regression: 1,001 players; actual EXPLAIN execution count confirms the roster function executes once. Existing missing/conflicting/stale/wrong-team facts and raw-data isolation checks pass.
- Proposed SELECT against hosted data, before view replacement: 986 rows in 708 ms.
- After migration, actual restricted application-role reads: jersey projection 986 rows in 2,773 ms; combined wallet/catalogue read 986 rows in 544 ms. Both passed a five-second database deadline. These include client-observed query latency, not a promise about every phone's total sign-in time.
- Eleven snapshotted member tables remained byte-equivalent under the existing guarded migration runner. Backup read-back verified. No real redemption activation.
- Typecheck and focused lint passed. Database regression output is retained in `qa/signin-recovery/database.txt`.
- Premium application `45b570ae`, deployment `dpl_5vnGoyBCXpy6rLK5W1PjNfKQhU2V`, restored after the fix. Eight live version/access/assets/disabled-redemption checks passed again.
- Post-restoration database inspection: zero abandoned application transactions and zero blocked queries.

No application bundle change was needed: the repaired SQL view is used immediately by the existing deployed premium application. The migration and recovery scripts are committed separately. Real payments, document collection and public signup remain disabled. No member purchases, entries, grants, messages or invitations were made.

This establishes the reproduced database regression and its repair, not fresh interactive acceptance on the owner's phone. The owner was asked to reopen Docked and retry. Physical S24 sign-in remains to be confirmed; no member credentials were requested or reused for testing.

Rollback: restore the previous application if loading regresses again; keep this compatible optimized view. Reverting to the old view would reintroduce the costly scan. Never restore ledger snapshots over later member transactions.
