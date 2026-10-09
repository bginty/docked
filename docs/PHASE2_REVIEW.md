> Historical/superseded product document. Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) is authoritative. This document does not authorize old features, providers, jobs or launch gates.

# Phase 2 engineering review — 2 October 2026

## Phase 5B supersession — 4 October 2026

The revised forward-only product direction supersedes any historical Docked betting-performance or historical betting ROI launch gate below. No retrospective Docked tips or profits will be reconstructed. Historical sporting statistics remain valid licensed model inputs; chronological model calibration, data-quality and software replay tools remain available. The official record starts only at its first genuine prospective live publication. See [model architecture](DOCKED_MODEL_ARCHITECTURE.md), [forward calibration](FORWARD_CALIBRATION.md) and [official record](OFFICIAL_RECORD.md). Older design details below are preserved as research/historical context, not current live-release prerequisites.

The work continues `codex/docked-value-platform` from clean commit `261cd83`. A–F were inspected and preserved. Before Phase 2 edits, the original validation passed: TypeScript, 35 platform tests and nine PostgreSQL tests. The seven requested project documents were read. No production deployment, DNS, real email, provider purchase or unrelated database mutation occurred.

## Material findings and repairs

| Area | Original problem | Repair and regression evidence |
| --- | --- | --- |
| Authentication | User verification and locally decoded session claims could come from different tokens; disabled/revoked sessions could still read member tables directly | Exact-token remote verification plus active, unexpired Auth session; all member RLS policies use a narrow active-session predicate. Token parser, cross-user, disabled/revoked/expired-session PostgreSQL tests |
| Signup consent | Repeated signup for an existing unconfirmed account could append new consents despite profile insert doing nothing | Initial preferences/consents are written only when profile INSERT RETURNING succeeds; repeated-signup SQL regression |
| Logout/deletion | Remote identity deletion could fail without durable completion; stale personal queue payloads remained | Immediate DB revocation, personal-data cleanup and durable idempotent erasure retry. Logout revokes sessions before remote sign-out. Account-disable, data-erasure and revoked-session regressions |
| Staff access | Privileged workflows lacked the full explicit lifecycle requested for Phase 2 | Role/MFA capability matrix, no editable-metadata authority, immutable lifecycle transitions and read-only auditor permissions; role and direct-write attacks tested |
| Strategies | Frozen parameters could be reused with a different deployed algorithm; paper and research gates were incomplete | Explicit seven-state lifecycle, validated reports/hashes, frozen material settings, matching full deployed code commit, forward paper isolated from public outbox. Research-only configurations below publication safeguards cannot freeze. Lifecycle, mutation, provenance and paper-isolation regressions |
| Matching/pricing | Lexical timestamp comparisons, ambiguous repeated quotes, incomplete ownership and mapping checks could misclassify quotes | Numeric instants; reject ambiguous duplicates, unsupported rules, mismatched sport/competition/market, blank or conflicting ownership. Original 3% strategy parameters retained; pricing/provider regressions |
| References | A previously approved reference quote could remain usable after operator approval was revoked | Revalidate every offered and reference bookmaker against current effective permission and ownership at evaluation, publication, observation and dispatch; revoked/expired/conflicting reference regression |
| Provider quota | Missing headers could become a zero; failed calls could escape accounting; concurrent requests could exceed shared limits | Null remains unknown; explicit independent budget, session-locked durable reservations and pre-request debit of known balance; provider and PostgreSQL crash/failure accounting regressions |
| Publication | Candidate/market joins could select incorrect rules; retrospective data could enter prospective paths | Match exact event/market/rules hash and prospective evidence; immutable candidate, availability and closing evidence; mismatched-candidate and protected-write PostgreSQL regressions |
| Corrections/results | Correction links could cross publications; outcomes required a separate authorised boundary | Same-publication correction checks; canonical authorised results import with status/rules/revision validation. Unsupported/ambiguous outcomes remain pending or manual review; results and correction regressions |
| Historical replay | Offset-formatted timestamps could permit look-ahead; delayed entry could relax original minimum odds; provenance checks were incomplete | Same pricing engine, numeric availability cutoffs, original publication minimum, structured dataset validation, frozen hashes/code, integrity-checked reports, no outcome display during initial import; replay and actual CLI fixture integration tests |
| Historical visibility | Renewing a region policy hid older records, including losses | Same-jurisdiction historical publications remain available under the current approved policy; renewed/restricted-policy PostgreSQL regression |
| Scheduled reports | A delayed historical report could label later corrections as known at the original report time | Settlement and availability queries stop at scheduled cutoff; past-loss/later-correction SQL regression |
| Scheduler | One job per invocation delayed later sport ingestion; observation errors could block unrelated account cleanup | Bounded ten-job drain, isolated observation incident recording; queue-drain and cleanup-isolation regressions |
| Delivery | Random unsubscribe tokens changed retry bodies under a provider idempotency key; crash recovery lacked a durable pre-send reservation | Stable HMAC token, durable conservative reservations, lease recheck, verified recipient and bounded 23-hour retry window; stable-token, malformed-input, preview-zero-network and local-sink regressions |
| CMS/SEO | Archived CMS content could fall back to the bundled draft; dates and read-time metadata could imply publication provenance | Any CMS override controls visibility, outage fails closed, distinct draft/published metadata, actual reading time, correction/date attribution, bounded sports/league pages; CMS/structured-data and browser checks |
| Edge presentation | Old publication odds could look current; an open page could remain active after price age expired | Distinct immutable/current quotes, explicit minimum/EV/fair-price/source time, clock-driven suspended/expired status; all five card states tested at 320px |
| Empty/restricted state | Inaccessible results could look like a genuine zero record | Unknown metrics are N/A; no-edge separates no qualifying opportunity, missing feed and regional restrictions. No invented events or opportunities; component/browser tests |
| Analytics | Limited taxonomy and incomplete consent/export handling | Seventeen finite event types, successful-action conversions, unique completion events, strict payload schema, per-write consent/active-account checks, no anonymous identifier, account export/deletion coverage. Taxonomy and PostgreSQL uniqueness tests |

## Architecture and limitations

The modular monolith remains appropriate: pure deterministic pricing/accounting, replaceable provider adapters, server-side policy and transactional mutations, an immutable database ledger, and research/worker CLIs outside HTTP requests. Authoritative secrets enter only server modules; `server-only` protects database access. Remote DB connections require TLS. Poll ingestion requires direct or session pooling; transaction pooling cannot preserve its session advisory lock.

Delivery remains at-least-once with provider idempotency. A reservation survives uncertain delivery, so failures can conservatively consume caps. After the provider retry window, operators must reconcile rather than retry blindly. Do not rotate sender/body configuration or `UNSUBSCRIBE_SECRET` while ambiguous retries remain. Worker throughput, concurrent crash recovery and real provider latency require isolated service testing before activation. Five-minute polling can miss two-minute decision windows and 180-second freshness limits; missed opportunities remain absent. A tighter cadence requires an explicit quota/capacity plan, not weaker freshness rules.

The 23-hour application retry bound stays inside Resend's documented 24-hour idempotency retention, checked 2 October 2026. [Provider documentation](https://resend.com/docs/dashboard/emails/idempotency-keys). A mobile browser scan also found a keyboard-inaccessible scrolling results table; named focusable regions and an explicit keyboard-scroll regression now cover that issue. Preview startup now uses Next's standalone server with copied static assets instead of the unsupported `next start` combination.

The results adapter accepts independently authorised canonical outcome files. It is not a newly licensed external results feed. Raw file storage is suitable for local preparation; durable private object storage and its retention/backup policy remain necessary on ephemeral hosting.

No genuine historical dataset or prospective sample exists. The strategy is **unvalidated**. Fixture arithmetic, successful tests and estimated EV are not evidence of profitability. Research split changes, held-out access and any new material configuration need their own version/provenance record.

## Integration boundary

Only an unrelated Oura project appeared in the connector's project inventory. It was not used. There is no dedicated Docked preview target, local Docker installation, Docked Auth configuration, provider key or authorised historical/results dataset. Both migrations were applied and security-tested against fresh embedded PostgreSQL, including restore tests; hosted Supabase advisors, actual GoTrue sessions and end-to-end account/email confirmation remain **pending**, not passed.

Public browser checks use a no-credential preview. Protected member/admin screenshots show actual access-denied screens. Synthetic edge/status screenshots are rendered in a private test harness, clearly marked fixtures; no fixture endpoint or performance row is shipped to public results. Full member/admin successful-login, real confirmation, export and remote Auth deletion acceptance must follow the runbook in [PREVIEW_SUPABASE.md](PREVIEW_SUPABASE.md).

## Analytics interpretation

Anonymous visits are not identified or written as events. `landing_view` and `signup_started` are supported only for an already consenting account; the anonymous acquisition funnel is therefore unmeasured. Acquisition source defaults to unattributed. Operational retained-account counts include signups, verified accounts and onboarding; behavioural metrics cover opt-in members only. Retention uses completed seven-day windows beginning on day 7/30/90, with consent present before and throughout the window. Deletion removes personal analytics. Email opens and alert engagement remain unknown; complaints count only received signed webhooks. No sportsbook passwords, stake amounts, losses, arbitrary URLs or form values enter the event store.

## External gates and exact next step

1. Supply an approved local Docker runtime, or a specifically authorised **Docked Preview** Supabase project and organisation/ref. Local Supabase is the quickest way to test confirmation mail without external sending.
2. Configure only the keys listed in [PREVIEW_SUPABASE.md](PREVIEW_SUPABASE.md), kept in ignored environment files or a secret manager; execute its migration, advisor and role/account checklist.
3. Supply a Docked-only odds key, written display/retention/derived-data rights, approved mappings/ownership and an explicit quota budget. Keep polling off until reviewed.
4. Supply an independently authorised results source and licensed historical odds/results manifest. Run the research workflow in [PHASE2_RESEARCH.md](PHASE2_RESEARCH.md), preserving the 2022–2023/2024/2025/2026-YTD separation.
5. Resolve operating entity, country/state legal review, communications rules and retention terms before enabling registration for real users, paper/live operation or optional mail. No production cutover is part of Phase 2.

Final commands, measured counts and screenshot scope are recorded in [qa/phase2/README.md](qa/phase2/README.md). Cost assumptions and every UNKNOWN are in [COST_MODEL.md](COST_MODEL.md).
