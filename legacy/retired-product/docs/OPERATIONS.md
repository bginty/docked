> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Admin and operations guide

## Phase 5D research operation status

The first manual fitting/prediction cycle succeeded with a complete six-fixture cohort. Comparison stopped at the separate market authority gate. Automatic research, market polling, refitting, paper/live publication and external notifications remain disabled. No repeating schedule has been activated.

The initial registered implementation is code 9d2a40cd. Later admin/CLI commits do not rewrite its recorded code. The controlled CLI intentionally rejects a different current code revision; do not bypass this by changing the stored model. A future reviewed execution/refit needs an explicit version/code decision, fresh authorised source snapshots and the existing gates. The new database-clock preparation fixes workstation skew without changing the statistical method.

Required next: resolve current market-comparison authority/quality and an exact regulation-results source; then perform a supervised full comparison cycle before considering recurring Preview research. No data purchase is currently required to reproduce the retained research fit.

## Phase 5D fitted-model operations

Use the [controlled manual fitting workflow](FOOTBALL_V1_FITTING.md). `/admin/model-performance` now reads actual retained fits/predictions; a current `/admin/research/[eventId]` view shows the model's actual team multipliers and probabilities. A requested historical research snapshot never gains later model output. These are private staff views, not public recommendations.

The first model does not consume injuries, lineups, news, weather or market prices. Model snapshot age is limited to seven days in the research policy; calculation does not refresh source age. Refitting requires a reviewed new version, manifest and code binding. Model result ingestion requires separate regulation-results permission; OpenFootball training sources do not receive it. Keep automation/publication off while comparison and results authority remain unresolved.

## Phase 5C research operations

Use `/admin/research` with current staff MFA to inspect source reviews, schedules, match files, evidence and editorial drafts. Authorised analysts/admins may record typed evidence; owner/admin governance controls source/feature/policy changes. Editorial staff review factual content separately from candidate approval. Never enter a probability, fair price, settlement or article body as a structured sporting fact.

The prepared OpenFootball CC0 catalogue is narrow research-dataset approval, not an enabled worker or an authoritative results source. Each registered source needs a reviewed endpoint/version, legal-use fields, actual observation clocks, retention, jurisdiction and request budget. Unknown or expired permissions stop fetching. Retained snapshots preserve what was observed; they cannot retrospectively claim that Docked knew a corrected result earlier.

Run the offline `research:source-check` command to inspect a pinned OpenFootball file without network/database writes. Quality receipts remain research-only. Use the existing durable worker for future enabled research jobs after the source, policy and runtime gates pass; an app page view never starts an external fetch. See [RESEARCH_SCHEDULER](RESEARCH_SCHEDULER.md) for the actual queue/retry contract and [RESEARCH_RIGHTS](RESEARCH_RIGHTS.md) for retention/revocation.

Research updates affect probability only through a frozen active feature and a reviewed estimator. The current estimator is unavailable; recalculation records must report abstention rather than an invented probability. Market Reference is fetched/compared separately after a genuine prediction has committed. Pre-match snapshots, post-match research and appended outcomes remain distinct.

No source account, paid plan, external email, recurring hosted polling or public Edge has been activated by preparation. Provider/source research and exact remaining gaps are in [RESEARCH_SOURCE_EVALUATION](RESEARCH_SOURCE_EVALUATION.md). Product/legal source approval and a source's public-data licence remain different decisions.

## Phase 5B operating plan — disabled schedules

Staff with current MFA use /admin/daily (Docked Today), /admin/model-performance and /admin/candidate-edges. Complete prediction cohorts are separate from paper, official and community performance. Unknown metrics stay unavailable. No sporting provider, fitted estimator or results source is configured.

| Job | Proposed cadence/trigger | Activation requirement |
| --- | --- | --- |
| Sporting fixtures/results | Daily cache refresh initially; bounded post-full-time checks | Approved source, storage rights and quota; adapter still future work |
| Model state update | New authorised sporting revision | Deterministic reviewed estimator and immutable as-of inputs |
| Probability calculation | Frozen event/model decision windows | Active model, pre-kickoff, fresh data; one retained cohort record |
| Market updates | Separate reserved provider schedule | Free trial does not authorise continuous polling; source rights/classification needed |
| Edge scan | Cached data at frozen windows | Commit probability first; scanner makes no provider request |
| Review | Human owner/admin | Fresh automatic revalidation; auto-publication false |
| Price monitoring | Existing bounded 5/15/60-minute observations | Eligible source and quota; no invented delayed price |
| Settlement/calibration | Authorised exact regulation outcome | Append result corrections; never infer from absent odds |

These are configuration guidelines, not enabled jobs. Unknown quota cannot accelerate polling. Price changes cannot rewrite a probability. Apply the additive Phase 5B migration after the first 15 migrations only to verified Docked Preview, with protected preimage/dry run and RLS verification. Recovery preserves immutable ledgers through reviewed forward repair/restoration. New methodology/features/data/decay require new model versions.


## Preserved Phase 5 operating boundary — 4 October 2026

Docked Preview is the dedicated Sydney project `bckkllmndoxzpzdqrevb` in organisation `ernfnkcbalhyqpsrzdwa`. Existing accounts and prior migrations are preserved. The current implementation and acceptance evidence are recorded in [BUILD_STATUS.md](BUILD_STATUS.md) and [qa/phase5](qa/phase5). The Oura organisation/project is unrelated and must never be used.

The Phase 5 ingestion path is separately gated by the exact preview identity, `MARKET_DATA_POLLING_ENABLED`, a dedicated provider key, reviewed effective-dated configuration, display/storage/derived rights, bounded raw retention, canonical mappings and a monthly quota ceiling. `THE_ODDS_API_KEY` and `ODDSPAPI_API_KEY` remain server-only. Keys/data were absent at that original checkpoint. Phase 5A subsequently completed the authorised, bounded Free-plan Odds API trial: nine attempts, eight successes, nine reported successful-response credits, and last-observed 491 remaining. Real fixtures/market observations are retained but polling is stopped; the failed attempt's charge is unknown. These are dated trial counts, not a newly queried quota. No sporting model dataset or authorised results feed was configured. See [trial evidence](PROVIDER_TRIAL_RESULTS.md).

The intended daily flow is scheduled ingestion → canonical market observations → versioned Market Reference → scanner → candidate review → gated publication → consented delivery → subsequent price observation → authorised outcomes → settlement → complete performance. The scanner operates on stored observations; opening the app spends no provider credits. Configure a supervised backend trigger only after the owner has approved the provider scope and budget. No hosted recurring trigger has been activated by this phase.

For that future supervisor, invoke `node --conditions=react-server --import tsx scripts/market-data.ts --sync-authorised-preview` on the reviewed ingestion cadence, and `npm run worker -- once` on a one-minute trigger. The importer serialises through a session lock, persists quota reservations/poll receipts and refuses calls sooner than the approved interval. The worker drains durable candidate jobs. Keep the credentials in the backend environment, supervise failures/restarts and measure elapsed time before choosing a hosting timeout. The owner reviews candidates in the app; a personal ChatGPT reminder or open phone/browser is not part of execution.

`POST /api/internal/edge-scanner` requires the dedicated worker bearer secret. `npm run worker -- once` uses the same durable jobs. Scanner runtime and the database feature flag both default off. A trigger is not publication authority. `AUTO_PUBLISH_DOCKED_EDGES=true` is rejected. Research approval records research only; paper/live approval repeats current price, strategy, rights, jurisdiction, freshness and immutable-publication checks. See [EDGE_SCANNER.md](EDGE_SCANNER.md) and [EDGE_APPROVAL_WORKFLOW.md](EDGE_APPROVAL_WORKFLOW.md).

Use `/admin/daily`, `/admin/data-health`, `/admin/edge-scanner` and `/admin/candidate-edges` after staff MFA. Operational alerts stay in the private admin store; no external message is sent. Unknown quota and missing observations stay unknown. Fix mapping incidents through reviewed configuration; do not type replacement prices or probabilities into a candidate. Keep results pending until a separately authorised source is available.

Raw market-data payload expiry is enforced by a bounded database purge, also called independently of polling activation by the worker. Run it on a supervised schedule before enabling ingestion. Canonical snapshots, derived references and official/community evidence have separate retention purposes and rights requirements; expiry of a raw payload never licenses deletion of a losing immutable record. See [DATA_RIGHTS.md](DATA_RIGHTS.md).

For additive preview migrations, capture a private preimage, verify the exact linked project, run the CLI dry run, apply only the reviewed ordered migration, and verify original account fingerprints plus closed publication/delivery gates. `scripts/hosted-preview/phase5-operator.ts` implements these bounded operations. Recover with a forward repair or restore into a new isolated environment; never drop audit tables to roll back a feature.

## Original environment setup (preserved background)

Use a dedicated Docked preview Supabase project or local Supabase stack. Do not use an Oura database. Supabase CLI created the original `supabase/migrations/20261002113546_docked_platform.sql`; canonical initial schema is `db/schema.sql` and the test checks equality. Later migrations are additive and ordered. The original empty-database setup is complete on the dedicated preview; it must not be repeated over existing accounts.

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
