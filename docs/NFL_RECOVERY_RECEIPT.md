# NFL rollout recovery receipt — 17 October 2026

## Refreshed recovery, 12:37 UTC

The chat's Full access selection now reaches the command runtime. DNS, HTTPS,
session-pooler TCP and authenticated PostgreSQL queries pass with certificate
verification. No endpoint substitution or elevation was required.

Fresh recovery directory: `private-data/nfl-live-recovery-20261017-refresh/`.
All 38 affected/dependency tables, Auth ID references, schema metadata, 99
function definitions and 79 migration records were captured in one repeatable-read,
read-only transaction. Economy revision remains 122. The independently refreshed
source roster projection is included; the original backup is retained.

Snapshot SHA-256: `f4e3131abbdf1957c30663615cc67ed95402122f10a6d87d98c777da2e6237c7`.
The offline restore drill again passed 38 tables, 3,743 rows, 57 primary/unique
constraints and 50 foreign keys. The limitations and row-level recovery procedure
below still apply. Run the drill/preflight with this directory as the first argument.
The new operator command `scripts/nfl-live-rollout.ts --check <directory>` checks
live records against this recovery evidence; `--apply` locks dependencies,
revalidates identities and archives exact preimages transactionally. It transforms
the current locked live aggregate; it never uploads a local test database.

No hosted writes were made while creating or checking this export. Private backup files are ignored by Git and must never be uploaded with the application.

## Captured material

Directory: `private-data/nfl-live-recovery-20261017/`.

- `snapshot.json`: 30 affected/dependency tables, 2,723,786 bytes. Exported through read-only connected SQL in chunks. Every chunk matched the same complete server checksum; no mixed-version export was accepted.
- Snapshot SHA-256: `1ec1200b5f2743cc2a53d90235dd59160966624092338dcfab93849783e71e1c`.
- Snapshot/server MD5: `da4795febdeea636a23863cbf6483732`.
- Receipt timestamp: `2026-10-17T09:58:13.973Z`. Economy revision 122.
- `dependencies.json`: eight supporting configuration/competition tables plus Auth user IDs for offline foreign-key validation. Captured separately; compare configuration fingerprints again before any write.
- `catalog.json`: current column types, constraints, indexes, triggers, policies, grants and 79 deployed migration records/statements for the three affected schemas.
- `functions.json`: 99 live function definitions, including the exact pre-migration economy guard.
- `live-final-check.json`: live economy, Auth and source-revision digests for comparison before deployment/cleanup.
- `cleanup-preflight.json`: provider-identity-derived eight-card manifest, exact archived preimages and state hashes. This is a preflight, not evidence that cleanup ran.

Coverage includes the entire economy aggregate (accounts, balances, lots, journals, ownership, allocations, packs, marketplace records), immutable issuance tables, beta cards/ownership/lineups/scoring/dependencies, and NFL player/allocation/entitlement projections. The backup does not include Auth password/session records, Storage objects, custom-role passwords or the 110 MB of existing raw-source bodies. Those resources are outside this rollout's mutation scope. Do not treat this as a full cluster backup or permission to mutate those resources.

## Verified recovery drill

Run `node scripts/nfl-recovery-drill.mjs`.

The script has no hosted connection. It checks the snapshot hash, recreates typed tables in an empty in-memory PGlite database, reloads every exported row, compares complete JSON values in both directions, and restores primary/unique and covered foreign-key constraints. UTC is explicit so timestamp comparisons preserve meaning.

Result: **38 tables, 3,743 rows, 57 primary/unique constraints, 50 foreign keys passed**. Two foreign keys into retained raw-source revisions remain external; Auth is represented by ID-only dependency stubs. This proves recovery of exported values and covered references, not a full Supabase disaster restore or all trigger behavior.

Run `node --import tsx scripts/nfl-live-cleanup-preflight.ts` for the offline retirement proof. It rematches accepted player identities to current provider identities and derives current card IDs, checks dependency records, then proves eight retirements preserve wallets/accounts/eligible cards/scarcity and are idempotent. It does not upload the resulting economy document or change live records.

## Recovery procedure for this rollout

1. Retain these private files and their hashes before any live mutation. Immediately before changes, compare deployed migration/function definitions, current state revision/hash and dependency fingerprints. Capture a new consistent snapshot if relevant records changed; do not overwrite this one.
2. Record the exact post-change revision/hash and archive each actual changed row in the cleanup transaction. Abort on any newly discovered card, offer, lineup or financial dependency. Preserve immutable allocation and raw-stat tables.
3. If application publication fails, disable history import/read flags and restore the previous compatible application. Keep new raw history and audit records. This is an application rollback, not a database replacement.
4. For a row-level recovery, work in one owner transaction with affected records locked. Match the current postimage against the recorded post-change hash. Restore only exact affected row preimages and necessary original function definitions from this backup, in dependency order, under a reviewed forward recovery migration. Leave later unrelated transactions, accounts, balances, eligible assets and raw history intact. Keep retirement audit evidence and never recycle serials. If postimages differ, stop automatic restoration and reconcile the intervening operations first.
5. Re-run referential, economy, wallet, supply and source-history checks before commit. Never restore this snapshot over the whole live database. A full-cluster failure requires the provider's separate supported backup procedure.

## Connection and provider alternatives

The saved connection uses session pooling on port 5432. Supabase documents direct connections for `pg_dump` and session pooling as the IPv4 alternative; transaction mode on 6543 is not interchangeable. The project API verified the direct hostname, but this command environment cannot resolve it or unrelated provider hosts. No guessed endpoint, disabled TLS or transaction-pooler substitution was used.

[Supabase's backup documentation](https://supabase.com/docs/guides/platform/backups) describes dashboard backups and the Management API backup inventory. It also states modern physical backups are not downloadable logical exports. No authenticated dashboard session or callable backup-inventory tool was available here, and local Management API access is blocked by the same DNS restriction. Consequently no provider backup date, download or restore availability is claimed. The working connected SQL export provided the scoped recovery path above without purchasing a backup service.
