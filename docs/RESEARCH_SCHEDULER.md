# Research scheduler

The existing durable worker handles `research-update` jobs. Automatic scheduling requires `RESEARCH_AUTOMATION_ENABLED=true`, the `research_engine` database flag, an enabled immutable source/policy schedule, a current approved automated source review and an installed fixed endpoint adapter. All shipped switches and schedules are off. No external cron was created by this implementation.

Policies explicitly define jurisdiction, required facts, freshness and pre-kickoff windows. Jobs bind event identity, captured kickoff, participant hash, source/policy schedule and window in their deduplication key. The most recent due window is selected; missed older windows do not generate an uncontrolled backlog. Cancellation, kickoff or participant changes invalidate a queued context. Existing leases, bounded attempts and retry/backoff preserve resumability and failure ownership.

Before HTTP, a committed reservation serializes the source, checks current rights, one in-flight request, daily request quota, minimum interval and circuit state. Failed requests still count. Unfinished reservations remain blocked for operator review. There is no refund/reset path. The reviewed pinned adapters have zero provider-credit cost; the ledger measures requests, not a hypothetical monetary subscription cost.

Requests use exact HTTPS resources, no redirects, bounded response bytes and a timeout. Raw evidence hashes are SHA256 of the response bytes; parsed dataset hashes are separate. ETag/Last-Modified are sent only when a compatible retained dataset exists for the exact source review. A 304 records an HTTP check without creating a new dataset observation or extending fact/payload expiry. Later match jobs can reuse the current retained dataset within the allowed interval; they record reuse and compile a research snapshot without another request or pretending the data was newly observed.

429/503 retry dates are honored conservatively alongside a one-day failure circuit. Safe error codes distinguish rights, rate limiting, body bounds, cache misses, adapter degradation and transport/validation failure. No raw remote errors, URLs with credentials or response bodies enter public diagnostics.

OpenFootball datasets remain research-only. Compiling a match snapshot does not infer lineup, injury, final result or model input from unmapped dataset rows. Recalculation records an audited request/abstention; a future separately governed fitted executor is required before any new prediction can be generated. Canonical Phase5B event/model/window uniqueness is unchanged.
