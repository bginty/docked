# Focused verification — 17 October 2026

| Check                                                                                                                                        | Result                                                                                   | Evidence                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Identity, official roster eligibility, cleanup and feed client platform tests                                                                | 12 passed, zero failed                                                                   | platform-final.txt                              |
| SQL roster gates, private evidence, append-only audit, atomic import/checkpoints, frozen-journal corrections and Weekly Core migration chain | 4 passed, zero failed                                                                    | database-tests.txt                              |
| TypeScript typecheck                                                                                                                         | Passed                                                                                   | typecheck.txt                                   |
| ESLint on changed TypeScript/JavaScript files                                                                                                | Passed, no diagnostics                                                                   | lint.txt                                        |
| Client boundary scan                                                                                                                         | No known server canary markers in 58 existing browser assets                             | client-boundary.txt                             |
| Actual separate Python API, isolated SQLite copy                                                                                             | Passed authentication, pagination, totals, duplicate import, correction and resync       | feed-verification/*.json                        |
| Original SQLite source                                                                                                                       | SHA-256 unchanged by API proof                                                           | feed-verification/real-api-verification.json    |
| Accepted recovery snapshot                                                                                                                   | Hash verified before reconciliation                                                      | reconciliation.json summary.snapshotSha256      |
| Aggregate and relational dependency verification                                                                                             | Zero active orphans; zero uncertain ownership/lineup references                          | local-verification.json                         |
| Both directions of catalogue coverage                                                                                                        | 493 eligible, 791 official supported rows all accounted for                              | reconciliation.json; team-position-coverage.csv |
| Per-team position totals                                                                                                                     | Each official row counted once; each team's eligible positions sum to its eligible total | Assertions in nfl-roster-final-reconcile.mjs    |

The client scan used the existing build, not a new canary build; it does not establish a fresh full-production-build secret scan. This task changes a test identity bridge and local reconciliation tooling, not UI bundles. No full production build, hosted deployment, authenticated hosted browser or physical-device acceptance is claimed. Earlier UI screenshots remain historical evidence and were not relabelled as this run.

The API proof found port 8080 unavailable and started the actual separate service against a copied database on an isolated loopback port. It did not treat the previous handover as connectivity proof. The source contains 80 final games, of which six are incomplete: 74 available, six incomplete, 192 not started. The source-owner's six anonymous rows are still unresolved. No additional roster evidence was fabricated to fill them.

During review, mixed transaction sentences needed explicit subject/action handling: injury qualifiers must not apply to neighbouring ordinary waivers, and subject-first waived/injured clauses must not be classified as ordinary releases. Regression assertions cover these cases; remaining ambiguous reserve cases are retained. The team-position report also now counts FB/DL under the existing RB slot and RB/WR once under its existing fantasy role.

Initial sandbox DNS/SQLite access and some Windows workspace overwrites failed. Read-only source access and local evidence writes were retried successfully with scoped permission. No production write, database reset or public-network exposure was used to work around these failures. Existing unrelated worktree changes were not included.

## Reproduction

Run from the repository with the private accepted snapshot and collected evidence present. Reconciliation refuses stale 32-team evidence after 72 hours; refresh official sources before using a later run to authorise acquisition. Do not change the time or weaken the freshness guard to replay old evidence as current.

```powershell
node scripts/nfl-roster-final-reconcile.mjs
node --import tsx scripts/nfl-roster-apply-reconciliation.ts
node scripts/nfl-reconciliation-report.mjs
node --import tsx --test tests/platform/nfl-final-reconciliation.test.ts tests/platform/nfl-roster-eligibility.test.ts tests/platform/nfl-testing-feed.test.ts
node --import tsx --test --test-concurrency=2 tests/database/nfl-roster-eligibility.test.ts tests/database/nfl-testing-feed.test.ts tests/database/weekly-core.test.ts
npm run typecheck
```

The local actual-service proof additionally uses:

```powershell
node --conditions=react-server --import tsx scripts/nfl-testing-local.ts --python=C:/Users/61412/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe --catalogue=docs/qa/nfl-roster-reconciliation/eligible-catalogue.json --position-reviews=docs/qa/nfl-roster-reconciliation/position-reviews.json --out=docs/qa/nfl-roster-reconciliation/feed-verification
```

The output directory option prevents overwriting the original accepted feed proof. Source-cache export and supplemental official-page collection are separate scripts; their private raw files and original recovery snapshots are intentionally excluded from Git.
