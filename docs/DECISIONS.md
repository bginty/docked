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
