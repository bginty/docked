# Non-destructive retirement boundary

No database migration or production-data deletion is included in this cleanup. Existing migrations remain immutable and in order. Retired application routes, adapters and worker entry points are removed from the active source and return tombstones where saved clients may call them.

Before any separately reviewed database retirement:

1. Inventory `private` and isolated beta schema routines, grants, cron schedules, queued jobs, provider credentials and dependencies. Inspect only verified Docked projects.
2. Record a backup/recovery point and audit counts. Preserve card ownership/provenance, scarce editions, transaction receipts, auth identities, social moderation, consents and historical research/publication records.
3. Revoke execution of retired publication, benchmark, odds ingestion and research routines from application roles and Supabase Data API roles, without affecting shared identity or fantasy routines. Test anonymous/member/staff denial and current fantasy transactions against the exact migration.
4. Disable retired database schedules and suppress undelivered optional betting notifications with an audit reason. Never delete publication history. Do not disable transactional account mail, account-erasure retries or social moderation maintenance.
5. Retain old profile columns and onboarding enum values until a versioned data migration is reviewed. Their presence is compatibility, not a live product feature. Historical account exports may include old records, only for their owner.
6. Review retention and credential revocation separately. Private local credentials must not be copied into new deployments; deleted runtime adapters cannot use them.

Until hosted grants and schedules are independently inspected, application retirement does **not** establish database-level retirement. Report that acceptance gap explicitly.
