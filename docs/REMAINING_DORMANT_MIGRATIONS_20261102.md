# Remaining additive Production migrations — approval package

The three approved migrations through `20261102010001` are already applied and unchanged. Do not rerun them. The two files below were introduced during the final blocker-resolution work, tested against real PostgreSQL and applied only to the existing isolated Preview. Neither is applied to Production.

| File | SHA-256 | Effect |
|---|---|---|
| `20261102011703_commercial_retention_controls.sql` | `30382db53d5ca29e869f385b640169b935808e1e57d9f3de8000735b74f9c20b` | Private dormant retention policy/holds/archive/audit and restricted worker role. No scheduler, active cleanup, financial mutation or activation. |
| `20261102023100_commercial_social_inventory.sql` | `2a019dce3789f34ce050b5ea70eb0cca5090fdbf69191f0e286c42875437d3a0` | Narrow server-only commercial inventory projection for Profile and card-sharing snapshots, preserving existing profile/card privacy and locking ownership during snapshots. No new inventory or broad legacy test-store grant. |

Prerequisites: approved commercial ledger/lineup schemas, existing `private.active_member_session`, `private.community_actor`, `private.social_collection_cards`, and existing app roles. Both are additive and idempotent. No competition, draft, entry, wallet, purchase, serial, card ownership, saved social snapshot or schedule is rewritten.

Evidence:

- **Full Production logical-restore rehearsal passed on 2 November 2026**: encrypted 81,276,071-byte backup captured 04:34:18 UTC, archive SHA-256 `135000f6cda9c2b0ec66d4c4f6ef4d4fe87039d22e9760ffefb3a803fe833656`. Restored to PostgreSQL 17.11 with no network, no exposed port and cron disabled. Applied and reapplied both exact files; protected record fingerprints unchanged, private RLS and restricted worker grants verified. Evidence: `qa/launch-convergence-20261102/restore/restore-drill.json`.
- This rehearses database data/schema and required role memberships. It does **not** restore Storage object bodies, provider secrets or hosted service configuration. Only pg_net's two unlogged HTTP transport-cache tables are excluded from fingerprints; no durable business queue is excluded. HTTP requests must not be replayed from a backup. A fresh pre-application drift check remains required.

- `qa/launch-resolution-20261102/retention-postgres.json`: twelve real PostgreSQL retention scenario groups.
- `qa/launch-resolution-20261102/commercial-social-postgres.json`: real PostgreSQL full migration fixture, ownership/privacy, expired-session and direct-role denial, concurrent transfer locking and activation/receipt preservation.
- Existing collection-privacy/expired-session database tests: 2/2 passed after projection addition.
- `qa/launch-resolution-20261102/preview-social-migration.json`: exact Preview hash plus identical protected Auth/profile, commercial control/cards/packs/receipts/lots/journals and entry fingerprints across application.

Before an approved Production application, capture a recoverable current backup, compare exact file hashes and existing migration history, inspect dependency definitions/grants and current data fingerprints. Apply each missing approved file once inside a transaction with lock/statement timeouts and its migration-history row. Stop on changed bytes, partial application, drift or unexpected records. Re-check protected business records, RLS and all activation flags immediately afterward. Do not overwrite legitimate operational telemetry to force a comparison to pass.

Retention remains disabled, with no login/key or schedule provisioned until the operations runbook and policy authority are separately satisfied. The social projection becomes relevant only when the already-gated commercial surfaces are enabled. A failed profile projection must produce a recoverable error, not a fabricated zero or fallback to beta inventory.

Rollback: disable affected runtime surfaces/worker and return to the recorded prior application deployment. Retain additive schemas, immutable financial history and archive/audit records. Do not drop retained data or re-run completed fulfilment. Function replacement/drop is unnecessary for an application rollback and must be separately reviewed if later requested.

This package prepares review; it is not a request to reapprove the commercial business model and does not authorise real-money activation.
