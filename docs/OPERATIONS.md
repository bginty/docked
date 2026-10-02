# Admin and operations guide

## Initial isolated environment

Use a dedicated Docked preview Supabase project or local Supabase stack. Do not use an Oura database. Migrations have not been applied to any hosted database. Inspect CLI help for your installed version, apply the checked migration only to an explicitly identified empty preview database, run advisors, then run the full auth journey. Supabase CLI created `supabase/migrations/20261002113546_docked_platform.sql`; canonical schema is `db/schema.sql` and the test checks equality.

Set .env.local from .env.example. Next loads .env.local automatically; CLIs require environment variables (for example `node --env-file=.env.local --import tsx scripts/worker.ts once`). Keep DATABASE_URL and secret keys out of logs and client bundles. Use port 3000 consistently with SITE_URL. Auth redirects must be allowlisted. Enable email confirmation, disable anonymous accounts, enforce strong passwords/rate limits and configure short JWT expiry. Preview signup/recovery can only target a localhost Supabase mail sink; no real email is sent from preview.

Assign staff through a reviewed database operation into private.roles, with actor and an audit event. Do not expose role assignment as self-service or trust user_metadata. Sign in, visit /mfa, enrol TOTP and verify before /admin. Owner/admin control pauses; analyst reviews candidates; editor drafts content; auditor reads only. Every mutation repeats checks server-side.

## Worker

```powershell
npm run worker -- seed
npm run worker -- once
```

Supervise a process/hosting job that invokes `once` every minute, and scales drain frequency only after load tests. Each invocation takes at most one durable job and one outbox item; the cron is only a trigger. Durable jobs are PostgreSQL rows. Concurrent workers claim with SKIP LOCKED. Lease expiry is 60 seconds, retries at 10×2^attempts seconds, maximum five attempts, then dead-letter. A crashed final lease is reaped to dead state. External provider sends use the same idempotency key on retries; they are not an exactly-once guarantee.

Polling is opt-in (`ODDS_POLLING_ENABLED=true`) and shared per sport in five-minute slots, never per page view. Provider quota/rights and canonical mappings must already exist. No provider discovery is allowed to auto-approve participants, operators or settlement rules. A failed request opens a five-minute circuit; a health failure prevents new candidates. Raw local-file retention needs a private durable storage adapter on ephemeral hosting.

Phase 2 adds an explicit `DATABASE_CONNECTION_MODE=direct` or `session` gate; transaction-pooler connections cannot hold the shared ingestion lock. Quota reservations and known-provider debits commit before requests. Failed or interrupted calls retain their conservative charge. The worker drains up to ten due jobs per invocation. It records observation failures and continues independent jobs, including account erasure. The one-outbox-item dispatch loop remains capacity-limited; measure it before any volume increase. `npm run worker` supplies the Node `react-server` condition because database modules are protected with `server-only`.

Each frozen strategy must match the full `DOCKED_CODE_COMMIT` for a reviewed local build, or Vercel's platform commit. Missing or conflicting values fail closed. Set this from the actual clean build checkout; never paste an older strategy commit into a newer worker to bypass provenance. Unknown outcomes remain pending. Ambiguous email attempts retain budget reservations and stop after the 23-hour retry window for operator reconciliation; do not rotate unsubscribe/sender configuration while such attempts remain unresolved.

## Publication

Load an approved frozen strategy/config hash and supporting validation runs. `active`, research, paper and owner approvals are distinct. Configure effective-dated region policies and bookmaker eligibility with review evidence. Select a candidate in /admin; publication recomputes it from current snapshots, verifies source health and region/bookmaker approval, and inserts the immutable publication plus outbox event atomically. Stale/mismatched candidates fail rather than being edited into eligibility. Auto-publication is not implemented or enabled.

Expiry/withdrawal appends a status event. It does not remove or settle the original benchmark. Reconcile an authorised Result with src/server/settlement.ts. A changed result revision requires a visible correction event linking old and replacement settlements and an analyst reason. Contradictions, abandonment, cancellation and rescheduling remain pending/manual review unless an approved settlement adapter explicitly defines void treatment.

## Notifications

Configure `EMAIL_SENDER_IDENTITY` with reviewed sender identification/contact details; it is included in every email together with a visible pause link. No real sender is invented. Recipient expansion respects stored sport (`football` / `basketball`), league (canonical competition key), and eligible bookmaker preferences. Blank lists mean no preference filter, not broader legal eligibility.

Owner research approval can start private forward paper independently of live activation. The analyst publication form defaults to paper. Paper publications never enter public results or edge recipient expansion. Generic optional digest/watchlist schedules currently create drafts for explicit editorial and recipient review; they do not automatically generate a campaign. Do not describe them as live email automation.

Availability collection uses actual observed snapshots at eligible 5/15/60-minute targets; one-minute measurement is absent with five-minute resolution. Closing diagnostics use the first valid sample T−13m to T−10m and disclose the T−10m cutoff. Missed measurements stay missing. Current public availability is revalidated independently of the immutable publication record.

Set sender identity, verified domain and provider signing secret only after permission. A publication expands into recipient outbox entries only for matching region/state, age attestation, separate edge opt-in and unpaused profiles. Dispatch checks current consent, source/price/strategy/policy, expiry and start, local quiet hours, two-edge/day cross-channel cap and a global 1,000-message/day budget. This budget is deliberately conservative and must be reviewed before a large launch. Quiet-hour time-sensitive edges are suppressed, not carried forward. Generic digests need editorialApproval and subject/text. Optional editorial schedule runs produce drafts/previews rather than campaigns.

Unsubscribe tokens are random, hashed at rest and durable before delivery. POST /api/unsubscribe works without login and suppresses queued optional mail; GET /unsubscribe shows a confirmation form. Signed Resend webhooks use raw-body Svix verification and event dedupe; bounces/complaints pause communications. A request already handed to a provider cannot be recalled; the final consent check is the dispatch boundary.

## Incident and provider outage

1. Pause publication and sending in /admin. Preserve archived records.
2. Inspect source_health, job_runs, outbox dead letters and audit_events. Never paste credentials into diagnostics.
3. Check clock skew, completeness, mapped rules, rights expiry and remaining credits. Keep suspicious large EV quotes rejected.
4. Correct canonical data through reviewed changes; append factual publication corrections. Never edit away a losing result.
5. Verify a clean snapshot and required gates before resuming with recorded owner approval.

## Backups and restore

Use provider encrypted backups and separately protected logical exports of required schemas, including Auth, private evidence and policy tables. Record RPO/RTO, encryption/access owner and retention before production. Restore into a **new isolated database**, keep sending/publication off, verify counts and hashes, run policy/lifecycle tests, then compare immutable publication/settlement/outbox records. Never restore onto the live database without explicit authority. Local PGlite tests are a schema/policy test harness, not proof of hosted disaster recovery.

## Retention and deletion

Raw feed retention follows licence, not an invented default. Propose operational request logs 30 days, delivery metadata 90 days, then aggregated statistics; obtain legal review before adopting. Immutable publication/audit evidence requires a documented retention basis. Account deletion disables profile and suppresses queue first, removes auth.sessions, then deletes the auth user with cascading personal data. Retained consent/audit rows hold a pseudonymous UUID; they remain personal data under applicable law and must not be called anonymous. Provider backups expire on their reviewed schedule. Test hosted session revocation and restoration before release.

## Metrics

Adult signup: verified, non-anonymous account with required attestations; not verified identity. Activation: first saved tip or completed preference update within 7 days. 30/90-day retention: a consented returning account event in the respective day window divided by the same eligible signup cohort, excluding deleted accounts consistently. Saved-tip usage: unique members saving an accessible tip / active members. Digest engagement: consented unique link clicks / delivered recipients, not unreliable opens. Unsubscribe/complaint: unique recipients / delivered optional messages. Data freshness and post-alert availability use measured snapshots only. Attribution must be consented and avoid sensitive query strings. No amounts wagered or customer-loss optimisation.
