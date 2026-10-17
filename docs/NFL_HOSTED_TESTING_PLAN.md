# NFL postgame feed — concrete hosted testing plan

Prepared 17 October 2026, following the isolated reconciliation from commit 08298555. **Not an activation approval.** No production deployment, production ingestion, new subscription or public tunnel was performed. All work below is limited to a separately bound testing environment.

## Readiness and remaining dependencies

The real separate service API has been verified locally against a disposable copy: 5,569 observations, 493 eligible Docked identities, 433 reviewed feed mappings, 60 players without recorded appearances, no remaining mapping conflicts among eligible players. Duplicate imports, corrections and resync passed. Six games remain incomplete because source identities are unresolved. They must not be represented as settled. Two catalogue identities and 23 reserve-status cases remain safely excluded; none owns test cards. See [reconciliation evidence](qa/nfl-roster-reconciliation/README.md).

The existing service on Windows port 8080 was unavailable during verification. An isolated copy of the actual Python service ran locally instead. A Vercel runtime's localhost is not this Windows computer. Hosted testing needs **a reachable authenticated HTTPS feed** plus **a separate test database**, followed by a narrowly reviewed connection-policy change. These external resources and exact bindings are not yet provided or verified.

## Deployment topology

1. Keep `docked-nfl-ingestion` separate from Docked. Build its existing non-root Dockerfile (user 10001); run `python -m nflfeed api`, bind container port 8080 behind managed HTTPS. Mount private persistent storage at `/data`, with `NFL_DB=/data/nflverse.sqlite`. Do not put SQLite or credentials in a public image or repository.
2. Seed an approved snapshot using SQLite's backup mechanism, check integrity and hash, preserve dataset `a78ff31f-6f3f-4ac6-9d45-34208626e325` and revision history. Never mount or expose the Windows source directory. Initial hosted proof can serve the fixed dataset without an ingestion worker.
3. For continuing updates, API and the existing single writer must share the same persistent volume on one approved host, with graceful shutdown and SQLite-safe backups. A managed platform that cannot share disks across services needs a reviewed same-instance process arrangement or a different approved single-host deployment. Do not deploy API and worker to unrelated ephemeral filesystems.
4. Use independent random reader/admin keys. Docked receives only the reader key. Restrict admin endpoints to operator access; preserve 401 responses for missing tokens and reader attempts at admin operations. Keep request logs free of tokens and full credential-bearing URLs. `/ready` is the existing health endpoint.
5. Bind a protected Docked test deployment to a dedicated Supabase/Postgres project or genuinely isolated branch, with independent credentials. Being in the same organisation is not isolation. Do not use the live Docked project `pojoymtniryarxxunyvz`, production auth users, production service-role key, or member financial/ownership tables. Reusing an existing unused test project is acceptable only after project ID, connection host, data and credentials are verified.
6. Run the standalone consumer as a controlled server job against that database; serve the owner report through the existing MFA/role-authorised owner interface. Do not put a multi-page initial import in a browser request or a time-limited page render. Start with manual one-shot imports, then add a single scheduled consumer only after hosted recovery tests pass.

For a Render candidate, a persistent disk requires paid compute and belongs to one service instance. It cannot be shared with another service, used by a cron service, or scaled across replicas; redeploys briefly interrupt disk-backed services. Use SQLite-aware backups, not a disk snapshot as the sole database recovery mechanism. [Official persistent disk requirements](https://render.com/docs/disks).

## Exact application configuration

These are **server secrets/configuration**, never `NEXT_PUBLIC_*`, mobile build variables or client requests.

| Variable                       | Required value or binding                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `DOCKED_NFL_TEST_COLLECTOR`    | `standalone-postgame`                                                                                                               |
| `DOCKED_NFL_TEST_DATABASE_URL` | Restricted-role connection to the specifically approved isolated database; TLS certificate verification required                    |
| `NFL_BASE_URL`                 | Approved feed HTTPS origin, with no credential in the URL                                                                           |
| `NFL_ALLOWED_ORIGINS`          | Exact approved origin; no wildcard or redirect-based fallback                                                                       |
| `NFL_API_KEY`                  | Reader key, at least 24 characters, stored in server secret configuration                                                           |
| Permit                         | `config/nfl-postgame-permit.json`, isolated-free-beta only; currently expires 10 November 2026, raw retention 30 days               |
| Mapping input                  | `docs/qa/nfl-roster-reconciliation/reviewed-feed-mappings.json`, checked against the API dataset ID                                 |
| Rules                          | `docked-nfl-postgame-full-ppr-test-v1`, existing fumbles-lost penalty −2 once per player; no production competition version changes |

The current `connectTestingFeedDatabase` intentionally accepts only loopback databases named `docked_nfl_test_*` and rejects `VERCEL_ENV=production`. **It remains unchanged.** Once the actual target exists, implement and review an exact allowed host/project/database identity binding plus a server-side database marker, validate TLS, reject the production project and production runtime, and add negative tests for look-alike hosts, wrong projects and production credentials. Do not loosen the guard to accept arbitrary remote PostgreSQL URLs.

Prepare a target-specific least-privilege grant migration for the consumer and reporting roles: private `nfl_test_feed` tables and isolated scoring journal only. No member API access, RLS bypass or broad `service_role` grants. Keep migrations separate from the runtime credential. Test unprivileged denials. No such hosted grant has been applied.

## Ordered activation runbook, after target approval

1. Record the exact feed origin, database project/branch ID, restricted role, application deployment ID, configuration digest, owner approval and rollback owner. Review the source-use permit and its expiry; testing permission does not establish commercial rights.
2. Back up the isolated database and feed with application-consistent backups. Restore into a second disposable copy and verify integrity. Do not reset or import production accounts. Use isolated fixtures for owner/member testing.
3. Apply the existing consumer migration `20261017042754_nfl_testing_feed_consumer.sql` and the existing scoring-journal schema to the isolated target. Apply separately reviewed scoped grants. The command refuses other member streams or old queued/leased collector jobs; investigate refusal rather than deleting jobs to bypass it.
4. For full pack/card acceptance, apply the existing tested schema chain to the isolated application database, append fresh official roster observations, review player mappings, and enable the official-roster policy there only. The 17 October roster evidence expires after 72 hours; refresh before later activation. Do not auto-release the four missing catalogue players or mint additional scarcity. The accepted cleaned aggregate needs a separately reviewed import/archive transition: the hosted immutable aggregate guard correctly rejects arbitrary asset deletion. Do not bypass it to load the local cleanup.
5. After the exact-host connection guard and grants pass review, run:

   ```powershell
   node --import tsx scripts/nfl-testing-sync.ts --initialize --mappings=docs/qa/nfl-roster-reconciliation/reviewed-feed-mappings.json
   ```

   Set credentials through the approved secret store, not inline in the command. `--initialize` is for this isolated target only. A changed API dataset requires new reviewed mappings and explicit resync; never reuse mappings across unrelated dataset IDs.

6. Create only recorded QA fixtures under `beta-real:qa:feed:*` using the test scoring version. Associate fixture/season/week explicitly. Do not derive old competition teams from current ownership or grant historical points to member entries. Current mapping coverage is sufficient for verified records; affected incomplete games remain non-final.
7. Repeat authenticated API pagination, wrong-token denial, duplicate import, interrupted-page rollback, checkpoint recovery, stale/incomplete data, correction approval, explicit resync and season-total reconciliation checks. Independently verify no wallet, ownership or account changes. Test quarantine against Standard, Premium, Starter, Weekly Core and direct admin issuance paths on the target.
8. Inspect the actual protected owner screen: freshness, six incomplete games, unresolved source rows, no-appearance labels, correction history and selected scoring version. Verify MFA and ordinary-member denial. This step has not been performed on hosted infrastructure.
9. Only after passing the preceding checks, schedule the same consumer with its existing lease/idempotency rules. Store last success, next retry and failures; recover missed jobs without replaying financial transactions. Do not start a second collector. Revalidate permit and roster evidence on every applicable execution.

## Cost and approval boundary

Prices checked 17 October 2026; USD, before tax, exchange conversion, overages and any provider-specific storage. These are planning figures, not an authorised purchase or a guaranteed account quote.

| Component                                                       | Incremental planning cost                                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Continue local verification                                     | No new service charge                                                                                                |
| Existing suitable isolated database                             | Potentially $0 incremental within current allowance; availability and capacity not verified                          |
| New Supabase free project                                       | $0 if eligible and within limits; 500 MB and two active-project limit, inactivity pausing applies                    |
| Additional Micro project in existing paid Supabase organisation | From approximately $10/month                                                                                         |
| New Supabase Pro organisation                                   | From $25/month including first project                                                                               |
| Example Render Starter API                                      | Published base $7/month, 512 MB / 0.5 CPU; persistent disk and any usage charges extra, exact current quote required |
| Protected app test deployment on existing Vercel plan           | Existing included usage may cover it; additional compute/build/bandwidth usage remains billable under that plan      |

Supabase amounts and limits: [official pricing](https://supabase.com/pricing). Render's published Starter example: [official comparison](https://render.com/articles/render-vs-railway); verify current [checkout/pricing](https://render.com/pricing) before approval. Vercel usage: [official pricing documentation](https://vercel.com/docs/pricing).

Indicative starting base is **$7/month plus storage/usage** with an already available or eligible free isolated database, or **$17/month plus storage/usage** with an additional paid Micro database. The persistent-disk price was not available in the retrieved current pricing page, so no all-in total is claimed. Resource sizing for the continuing writer still needs measurement; larger compute may be necessary. No commercial sports-data licence cost is included or assumed.

The next owner decision is approval of an actual HTTPS host and isolated database target, with a concrete spending cap after the provider quote. Existing paid capacity can be considered first. No purchase or activation occurs merely by approving this document for review.

## Stop and rollback

Disable the testing collector flag/schedule, revoke or rotate its reader key, and preserve the test database's generations and correction audit. Restore only the isolated target from its verified backup if required. Revert the target-specific configuration/deployment; never drop a shared schema or restore over live Docked. Production balances, member assets, scoring versions and collector configuration stay unchanged.
