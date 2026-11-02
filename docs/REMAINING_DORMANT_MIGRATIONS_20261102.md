# Remaining additive Production migrations — approval package

The three approved migrations through `20261102010001` are already applied and unchanged. Do not rerun them. **Both files below were approved by the owner and applied to Production on 2 November 2026 at 07:27 UTC. Do not rerun them.** They remain dormant; no retention cleanup, payment, registration or prize activation was authorised or performed.

Final application evidence: `qa/final-australia-20261102/migrations/apply.json`. Fresh encrypted backup captured 06:43:29 UTC, 81,292,740 bytes, SHA-256 `851a4cdfbeb94cb2cb20d6872037b35eafe31d0c637a5414fc28337a265583d2`. The full isolated restore/reapplication preserved 545 durable table fingerprints. The Production transaction preserved all 330 protected table fingerprints and existing core RLS/grants. The subsequent independent committed-state readback is recorded in `migrations/post-commit.json`.

The initial preflight stopped on normal activity during the backup: one verified refresh-token rotation, Auth timestamp/IP metadata, scheduler ticks and appended run logs. A field-level comparison verified unchanged credentials, identities, security claims, schedule commands and business records before permitting that operational drift. No removed rows or rewritten job history were exempted. A separate truncated local schema export also stopped before writes; the export now drains its input and requires the complete PostgreSQL dump trailer. The complete schema matched before application. All checks and minimal field-name/count diagnostics are retained without Auth values.

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

## Exact change review for the owner's 2 November approval

The hashes above are the approval boundary. Neither file has been changed by this review. Approval of one file need not approve the other or enable its runtime.

### 20261102011703 — operational retention

**Before:** commercial notifications/retries remain in `commercial_billing.jobs`; there is no dedicated retention policy, legal-hold registry, encrypted minimisation archive or restricted retention worker role. Existing financial records and encrypted purchase references are retained by their current systems.

**After application, still dormant:**

| Object | Change and effect |
|---|---|
| `billing_retention.policy` | New singleton, inserted only if absent. Disabled by default. Proposed defaults: completed jobs at least 90 days old; archive 30 days. Enabling later requires recorded authority and expiry. Existing policy is not reset on rerun. |
| `billing_retention.holds` | New all/job/receipt/member holds with case reference and review date. An overdue review does not release a hold. |
| `billing_retention.archives` | New encrypted job-metadata archive, digest and expiry; references the original job. Empty on application. Encryption occurs in the worker, not by copying plaintext during migration. |
| `billing_retention.tombstones` | New immutable record of job minimisation, preserving duplicate/replay evidence. Empty on application. |
| `billing_retention.audit` | New immutable operator/worker action trail. Empty on initial application; subsequent policy/hold edits are audited. |
| `commercial_billing.jobs` | **No rows changed by migration.** Adds restricted worker read/update policies and grants on only `receipt`, `attempts`, `last_error`, `next_attempt_at`. Future updates require a completed, unleased old job, active approved policy, existing archive, no applicable hold and no open recovery. Worker cannot requeue a completed purchase or delete jobs. |
| `commercial_billing.receipts`, `commercial_billing.recovery_cases` | Adds worker SELECT on only the receipt/member linkage and recovery state needed to exclude held cases. No purchase-token access, updates or deletes. |
| `docked_retention_worker` | New **NOLOGIN**, non-superuser, no-bypass-RLS role. Migration creates no credential, role membership, scheduled job or service activation. |

All five new tables have RLS enabled. Public, anonymous, authenticated, service-role and commercial-app grants are explicitly revoked on the new schema/tables. Only the dedicated operator role gets the described permissions. The worker can insert archive/tombstone/audit records; archive deletion requires expiry, active policy and renewed hold/recovery checks. Policy/hold changes and cleanup share an advisory transaction lock. Audit and tombstone modification/deletion are rejected.

**Financial implications:** no charge, credit, refund, entitlement, card, serial, commission or ledger change. The future cleanup surface excludes wallets, journals, financial lines and encrypted purchase tokens. There is no new recurring service. Archive key custody and the eventual worker schedule require separate operational configuration.

**Customer-data risk:** a later mistaken retention activation could minimise useful operational metadata. A lost archive key would prevent recovery of that metadata; eventual archive expiry is irreversible. Therefore applying this dormant schema is distinct from approving periods, deploying a key or enabling cleanup. Active disputes, unresolved jobs and legal holds must remain excluded. The seven-year financial-record baseline is not permission to retain all personal information for seven years.

**Rollback:** before activation, leave the additive schema/NOLOGIN role dormant and revert the application if necessary. After any separately approved minimisation, disable `DOCKED_RETENTION_APPLY`, then the worker; preserve audit/tombstones and encrypted archives. Restore archived metadata only through a reviewed transaction, never by replaying fulfilment. Do not drop the schema or delete audit records as rollback. Expired archives cannot be reconstructed from a key alone.

### 20261102023100 — commercial social inventory

**Before:** the commercial ownership ledger exists, but the shared Profile/social code lacks its narrow server-only inventory projection. Broad access to the older test inventory would be an incorrect substitute.

**After:** creates/replaces only `commercial_billing.social_inventory(uuid)`, a security-definer function with an empty search path. It requires a valid authenticated member session and the existing community actor/privacy checks. It selects current ownership from `commercial_billing.cards`, joins `definitions` and **opened** `packs`, includes only NFL/AFL/NRL, and passes the result through `private.social_collection_cards` for subject/privacy enforcement. `FOR SHARE` holds ownership rows through the caller's snapshot transaction so a concurrent transfer cannot create a false ownership claim.

**Access changes:** only `docked_app` gets schema usage and function execution. PUBLIC, anon, authenticated, service_role, beta-app and commercial-app execution are explicitly revoked. No existing table RLS policy is weakened; no broad SELECT grant is added. The definer function is deliberately narrow and relies on the existing validated-session and privacy functions, whose definitions must match the rehearsed dependencies.

**Financial/data implications:** reads only. No balance, ownership, unopened pack, original serial, transaction, competition or existing post snapshot is changed. Listed-but-owned cards remain owned; transferred-away cards do not appear for the former owner. NBA stays excluded. Runtime customer access still depends on the separately disabled commercial/public features.

**Risks and rollback:** unexpected dependency drift could change privacy behaviour; row locks may briefly delay concurrent transfers. Abort on drift. Roll back the consuming application or disable its commercial surface; keep historical snapshots and ledger data. If the function itself must be withdrawn, revoke its app execution in a separately reviewed change rather than dropping customer records.

### Approval and application boundary

Requested approval is **only** to apply the two exact dormant files with the listed SHA-256 checksums. It does not approve retention deletion, revised policy publication, payment/product activation, public signup or prizes. On approval, take a fresh encrypted backup, compare migration history/dependency definitions/RLS and data fingerprints, apply missing files transactionally with lock/statement limits, then compare protected records and disabled activation flags. A material mismatch stops that application; successful rehearsal is not a substitute for this final drift check.
