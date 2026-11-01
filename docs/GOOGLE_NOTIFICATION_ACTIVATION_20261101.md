# Google TEST notifications — exact remaining activation

The HTTP boundary and durable worker are implemented. This is **not** evidence of genuine Google push delivery or ordinary customer checkout. Payments and new-purchase admission remain disabled. The prior isolated refund evidence remains valid but used explicit verification, not RTDN.

## Database and recovery

The owner-approved migrations `20261031123611` and `20261031123931` were applied atomically on 1 November. The added `20261031234304_google_test_reconciliation_queue.sql` is separately prepared for approval. It creates an empty RLS-protected queue and two indexes. Only the existing application runtime can read/write it; anonymous, member, service_role and the unrelated public runtime have no access. No customer balances or receipts are inserted. The three-migration disposable PostgreSQL check preserved 251 pre-existing table fingerprints, exercised transactional rollback and migration-ledger replay, and verified queue permissions/deduplication.

Use the existing migration ledger with exact source/hash comparison. These migrations are not designed to be blindly replayed as raw DDL. The Production backup is encrypted with its key outside Git; it contains 11 relevant tables and three replaced function definitions, plus fingerprints for 12 tables. Append-only wallet history was fingerprinted in PostgreSQL, not downloaded as one 313 MB JSON value. This is a targeted recovery snapshot, not a complete Supabase Auth/storage disaster-recovery backup.

Rollback: disable the worker/new purchase flags and retain receipts, queue, audit and outbox records. Restore the previously captured compatible application deployment. Do not restore old wallet documents over subsequent activity. Restoring function definitions is an operator-reviewed operation, only while the new programmes are disabled. Do not delete a populated queue or financial records as a rollback shortcut.

## Existing infrastructure, no new host

Use the existing Vercel application and Supabase `pg_cron`/`pg_net`. No additional persistent host is required. Scope activation to TEST receipts only.

1. Apply the separately approved queue migration with the reviewed transaction/ledger procedure.
2. Configure server-only `DOCKED_STORE_REFERENCE_KEY`, `DOCKED_STORE_ACCOUNT_BINDING_SECRET`, existing restricted verifier email/private key, and a random `DOCKED_STORE_WORKER_SECRET`. Keep the same encryption/binding secrets for already-bound receipts. Never rotate by discarding old decryptability.
3. Create a dedicated Pub/Sub topic in `docked-play-verification`, with Google Play's documented notification publisher granted **Publisher on that topic only**. Configure the exact topic in Play Console. Do not give the verifier release or developer-administrator permissions.
4. Create a dedicated push identity with no customer-data permissions. Grant Google's Pub/Sub service agent the scoped permission to mint its OIDC token; grant the configuring operator only the required service-account use permission. These are new security-sensitive grants and need action-time confirmation in the browser.
5. Create an authenticated push subscription to `https://docked.com.au/api/store/google/notifications`. Configure exact `DOCKED_GOOGLE_PUSH_AUDIENCE` (that URL), `DOCKED_GOOGLE_PUSH_SERVICE_ACCOUNT` and fully qualified `DOCKED_GOOGLE_PUSH_SUBSCRIPTION`. Configure retry/backoff and monitoring. The handler requires Google RS256 signatures, issuer, audience, verified email, exact subscription/package and bounded payload; it acknowledges only after durable insertion. No bearer download/purchase tokens are written to logs or queued message bodies.
6. Set `DOCKED_GOOGLE_RECONCILIATION_ENABLED=true` only after the private TEST runtime is configured. This does not enable new purchases. It may revisit **only existing, account-bound TEST receipts**, including when a member's test admission has expired. Unknown receipts cannot select an account or issue credits.
7. Store the worker bearer secret in Supabase Vault, not in the visible cron command. Register one named minute job with `cron.schedule`, calling `net.http_post` to the exact `/api/store/google/reconcile` URL using the Vault secret, `Authorization: Bearer …`, JSON content type, empty body and a bounded timeout. No Cookie or Origin header. Inspect the existing job by name first; update it rather than adding duplicates. Keep disabled until the endpoint and secrets are verified. Existing NFL jobs must remain untouched.
8. Observe Google's Console test notification reaching the persisted queue. Then observe an actual authorised TEST purchase/refund event and server re-verification. A Console test notification alone does not prove refund delivery. Simulate missing and repeated notifications separately; ensure the minute sweep catches missed pending/purchased receipts.

The bounded tick schedules at most 100 known receipts, claims two verification jobs and one consumption job. Leases use `SKIP LOCKED`; expired leases retry. Verification retries back off to an hour, with persistent operator-attention state after 12 attempts. The worker response reports pending/working/attention/overdue counts without identities or tokens. Operational alerts must consume this health result or a scoped database monitor before relying on unattended processing. No paid alerting service is required.

Pub/Sub is currently unconfigured (no topics observed). Before activation confirm existing project permissions and available no-charge quota. No new paid plan or recurring service is authorised. No Cloud IAM, topic, subscription, production worker secret or cron job has been created by this change.

## Acceptance still required

- The ordinary nominated account must complete normal email confirmation, password creation and consent; no reviewer bypass.
- A test-capable native product allowlist is required for ordinary member checkout; v27 intentionally has an empty allowlist. Do not enable real-money products in a public build to satisfy this test.
- An authorised store-installed Android licence tester must complete ordinary-session checkout, wallet, pack and refund acceptance. The disconnected Samsung's previous v27 installation/session tests need not be repeated without a new build or regression reason.
- Real-money fulfilment and commercial refund recovery remain separately gated. The TEST verifier rejects real purchases; a successful TEST order is not approval for paid launch.

Official setup references: [Google RTDN](https://developer.android.com/google/play/billing/getting-ready#configure-rtdn), [authenticated Pub/Sub push](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions).
