# Engineering decisions — 2 October 2026

1. Replace the static storefront with Next.js App Router/TypeScript, PostgreSQL/Supabase Auth. Static GitHub Pages cannot host authenticated server mutations or durable workers. No domain cutover is performed.
2. Modular monolith: `src/core`, `src/providers`, `src/research`, `src/server`, `src/content`, public/member/admin routes. Research and worker CLIs are outside web request handlers.
3. Exact npm versions and package-lock.json. Node 22+ is required: the current Supabase changelog dropped Node 20 support. Next 16 async request APIs are used. No long backtest in an HTTP request.
4. Fail closed. No credential creates simulated live data. No jurisdiction starts approved. Public educational content is accessible; actionable records require a verified profile and approved effective-dated policy. Trusted anonymous geolocation is deliberately not assumed; anonymous visitors receive restricted tips. This is more restrictive than a reviewed region-aware anonymous release and must be revisited before launch.
5. Sensitive tables live in a non-exposed `private` schema with RLS and revoked API grants. Member tables expose only own-row SELECT. Audited mutations use authenticated server handlers and parameterised SQL. Database credential is server-only and needs a dedicated least-privilege application role before production.
6. Staff roles are stored in `private.roles`, never editable auth metadata. Every admin mutation checks role and aal2 MFA. Sensitive identity checks verify the user remotely and confirm auth.sessions still exists.
7. Immutable publications/audit/settlement/correction/consent/launch records have database triggers. Source snapshots and personal records are separate. Publication insert creates its outbox event in the same transaction.
8. Queue claims use SKIP LOCKED and lease tokens, bounded attempts, delayed retries and dead-letter states. Delivery is at-least-once with provider idempotency, not exactly-once. Global dispatch serialization trades throughput for conservative notification caps during initial rollout.
9. The 1,000-message/day global worker ceiling is a conservative initial safety budget, not an assertion of capacity. Scaling requires measured quote decay, latency, consent metrics and explicit review. Marketing and edge opt-ins are separate.
10. Original storefront source is retained under `legacy/storefront` and Git tag. It is outside Next's `public/` directory. Never deploy the full source root as GitHub Pages. Product support details are identified as inherited rather than newly verified.
11. Preview is noindex, uses no payment integration, and never sends real emails. Draft legal and editorial text is labelled. No marketing automation was created in the Codex app; schedules belong to the application.
12. First business day currently means first Monday–Friday. Public-holiday handling needs an approved calendar before local schedule activation. Schedules persist their next run. Missed slots enqueue one at a time with the original slot key; idempotency prevents repeated execution. Time-sensitive alerts independently expire and are never revived by schedule catch-up.
13. Closing diagnostics use the first fresh valid reference observation between T−13 and T−10 minutes, with an explicit T−10 cutoff. This is a declared pre-start proxy, not the final bookmaker close. Five-minute source resolution means one-minute availability remains missing. Observations more than 60 seconds after a target are omitted.

## Official documentation checked

- https://nextjs.org/docs/app/getting-started/installation
- https://supabase.com/changelog — relevant Node 22 requirement, explicit table grants, PG17 notes; markdown endpoint unavailable, HTML checked instead.
- https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- https://the-odds-api.com/liveapi/guides/v4/
- https://resend.com/docs/webhooks/verify-webhooks-requests
- https://resend.com/docs/api-reference/emails/send-email

No hosted project has been linked, changed or purchased. Current installed versions are recorded in package.json and the lockfile.

## Phase 2 decisions

14. Preserve both the completed implementation and original migration. Add one ordered security/lifecycle migration; a forward repair or verified restore is safer than destructive rollback of ledger evidence.
15. Frozen prospective strategies require both the material configuration hash and full deployed code commit to match. Missing/conflicting provenance disables evaluation, publication, dispatch and observations. New parameters require a new version; code changes also require a reviewed version/approval record.
16. Quota reservations commit before external calls. Ingestion uses direct/session PostgreSQL connections and a session advisory lock; transaction pooling is rejected. Unknown provider quota remains null and requires an independent explicit local cap. Remote DB connections require TLS.
17. Marketing, service authentication, analytics and education consent remain distinct. Anonymous analytics is unmeasured. Completion events use database uniqueness; account deletion removes behavioural analytics and mutable personal payloads while retaining pseudonymous audit evidence subject to reviewed retention.
18. Production email remains impossible in preview. The local mail adapter writes only reserved test/invalid recipient messages, and local Supabase SMTP is the required confirmation sink. Delivery retries use a stable HMAC unsubscribe token and a conservative bounded provider-idempotency window.
19. The worker drains at most ten jobs per invocation. Observation failures are separately recorded so independent account-erasure work can continue. Provider polling still uses five-minute slots; missed decision/freshness windows remain missed and must be measured before enabling a tighter cadence.
20. TypeScript is pinned to 6.0.3 because the current TypeScript ESLint 8.71.0 peer range is >=4.8.4 and <6.1. The prior 7.0.2 exceeded that range. This is an explicit compatible-toolchain adjustment, not a forced install or skipped lint rule. CI now runs lint and the complete dependency audit.
21. Staff screenshots without a real Auth service show the actual denied state. Isolated status-card fixtures exercise UI only, never create a public performance record, and cannot substitute for authenticated browser acceptance.

## Phase 3 decisions — 3 October 2026

22. Preserve `e54adf2` with annotated rollback tag `docked-before-phase3-2026-10-03`. Community additions use three ordered migrations; the canonical official strategy, odds calculation, research and live-release gates remain separate.
23. Social discussion is mutable under audit; a verified community Edge is permanent. Moderation, account erasure, profile privacy and blocking change identity/commentary visibility without removing canonical wins or losses. Retained pseudonymous evidence needs a reviewed retention basis before release.
24. Community verification trusts only retained current-provider standard-price metadata, exact canonical rules, fresh timestamps, operator permissions and server time. Unknown promotion status fails closed. The initial Odds API adapter does not establish standard-price classification; supplying its key alone cannot enable community competitive records.
25. Final submission serializes market ingestion, rechecks policy and price after locks, and atomically writes the Edge, evidence/status, discussion projection and audit. A changed observation requires renewed confirmation. Screenshots remain moderated social media, never verification or settlement evidence.
26. Top Docked V1 ranks exact net standardized units from one-unit eligible records, with minimum 20 non-void settlements and seven active UTC submission days within the chosen period. Deterministic ties use maximum drawdown then durable profile ID. Display precision cannot change rank; followers and membership never enter it. Corrections preserve prior evidence and produce reproducible recalculation.
27. Free entitlements remain available after the recorded first-year growth window; no automatic conversion or cards. Pro, billing, competitions, prizes, deals and affiliates remain disabled in runtime and database constraints. Admins can record immutable, idempotent commercial drafts; activation requires a separately reviewed implementation and explicit authority.
28. In-app notifications are distinct from external sending. Separate categories respect consent, pause, quiet hours and caps. New finite analytics events avoid free-form sensitive data; completed actions are server-only. Consented community retention and operational moderation/verification counts use separately labelled denominators.
29. All community profiles/posts remain noindex in this preview. Only privacy-approved projections are returned; member graphs use keyset pagination. The PWA caches only a public offline shell, never authenticated routes, API responses, provider prices or private media. An update waits for an explicit member action so a draft is not silently discarded.
30. Phase 3 UI success states use explicitly labelled isolated DEMO fixtures outside application routes. No genuine community activity, historical performance, provider availability, financial advantage or strategy validation is inferred from test success. Hosted Auth, concurrency, supplier rights and legal review remain external acceptance gates.
