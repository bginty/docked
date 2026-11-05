# Combined SQL rehearsal on the restored archive

The exact prepared monitoring and public lineup packages applied together on PostgreSQL 17.11. Reapplying both transactions produced identical data and access rules.

| Check | Observed result |
| --- | --- |
| Recovery source | The existing 88,297,824-byte archive captured at 20:33:06.965 UTC on 5 November 2026 passed AES-256-GCM authentication and matched its saved SHA-256. All 43 recorded count and row digests matched after restore. |
| Packet hashes | Monitoring `b3e7ff04182b33f351c4c897550959ba3885c5f9960b1733a1a255ff5526e121` and public lineup `22962aa966391b4bf3ea33bebdfb1b07a0199241e576d3890872b9d12cca77b1` matched before applying. |
| Data comparison | The 43 archived groups and 13 additional groups retained all existing rows. The only excluded additive rows in those comparisons were one disabled ops flag, six new competitions and six disabled bindings. The new overlay table contained 49 distinct players, 43 NFL and six NRL, with the reviewed version, candidate digest and deadline. |
| Competition rules | The six previous bindings stayed byte-identical at the row level and disabled. The six future bindings remained disabled, with the reviewed Traditional caps, uncapped All-Star, zero entry fee and no cash prize. The archive’s dormant policy retained Terms v2 and Privacy v2. The already approved Privacy v3 binding was outside this rehearsal. |
| Permissions | Role attributes, memberships and existing grants stayed identical outside the reviewed changes. The new RPC grants were limited to signal and enqueue for `docked_commercial_app` and the scoped queue for `service_role`. The overlay table has RLS and no non-owner grants. The reader wrappers have no non-owner execute grants. |
| Runtime row rules | With the flag disabled, the scoped operations calls returned false or null. Under `docked_app`, synthetic ordinary outbox rows remained readable and updateable, reserved rows could neither be read nor updated, forged purposes and prefixes were rejected, and direct overlay access was denied. The fixture transaction rolled back. |
| Isolation and teardown | The existing image ran with no network or published ports. PostgreSQL accepted only its local Unix socket, its data directory lived on container tmpfs, and cron and the network worker were disabled. Decrypted archive bytes streamed to `pg_restore` without a plaintext file. The container and tmpfs were removed and the container ID could no longer be inspected. |

This verifies a logical database restore and the two prepared packages against that archive. The restore mapped object ownership to local PostgreSQL and reconstructed captured roles without passwords. Production received zero queries or writes. Hosted account access, Google Billing and outbound alert delivery were outside this test.

The [machine-readable result](combined-postgres-rehearsal.json) records the engine, exact hashes, affected IDs, access checks and teardown.
