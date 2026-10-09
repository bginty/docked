> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Email dispatch decision — 9 October 2026

Baseline application `bbd302b8`, evidence `4dd4ac1f`. Target only `pojoymtniryarxxunyvz` in Docked Production. No database mutation, deployment, email, account activation, scheduling, Microsoft permission change or certificate change was performed for this investigation.

## Recommendation

Keep `pg_net` absent. Use the existing encrypted durable outbox and signed Supabase worker, triggered once by a trusted operator process during an explicitly approved, supervised owner-only acceptance window. Prepared command: `node scripts/owner-mail-dispatch.mjs --check`. This default check makes no request and reads no secret.

This removes the database HTTP queue from the delivery path. It requires no extension privilege changes, new SQL functions, new services or new credentials. It is a proposed supervised testing path, **not an activated scheduler or a reliable unattended beta service**. The signed worker and its server-side support-only recipient enforcement already exist; their implementation was not changed.

For continuous beta operation, select and review an existing trusted server host that can reliably invoke the worker and monitor backlog. Do not copy the hook key to the public Next.js runtime as a shortcut: it authorizes more than draining and participates in queue encryption. A permanent host needs a separately reviewed credential boundary, outage/backlog monitoring, rate limits and hosted failure acceptance. No new host, automation, cron job or secret was created here.

## Precise root cause and current evidence

Live read-only evidence: `docs/qa/beta-policy/mail-scheduler-readonly-audit.json`.

- `pg_net` and schema `net` are absent after the earlier guarded rollback. The scheduler is disabled, with no ticks, requests or cron jobs. There are zero Auth users. The one mail row is the historical controlled/accepted check; there are no outstanding jobs.
- `pg_cron` 1.6.4 and Vault 0.3.1 are owned by `supabase_admin`. The private scheduler, encrypted outbox and event tables are owned by `postgres`, owner-only ACLs, RLS enabled.
- `anon`, `authenticated`, `docked_app` and `docked_beta_app` cannot SELECT the private outbox or EXECUTE `public.docked_mail_queue(text,jsonb)`. Only the privileged worker's service role and database administrator have the queue RPC capability. Existing reviewed queue privileges were not changed.
- `docked_app` and `docked_beta_app` are LOGIN roles. `anon` and `authenticated` are NOLOGIN. None of these four roles is superuser or BYPASSRLS.
- No global, `net` or `private` entries exist in `pg_default_acl`. The problem is **explicit installation grants**, not a local `ALTER DEFAULT PRIVILEGES` rule.
- The earlier installed queue ACL included `=arwdDxtm/supabase_admin`: empty grantee means PUBLIC, covering read, write, truncate and other table privileges. The extension's upstream installation SQL explicitly grants PUBLIC schema USAGE and all table/sequence privileges. Default PostgreSQL function EXECUTE also explains the outbound functions' PUBLIC execution. Source: [pg_net installation SQL](https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql).
- Readback of `extensions.grant_pg_net_access()` shows an INVOKER event-trigger function owned by `supabase_admin`. It adds explicit schema usage to managed API roles and applies legacy function adjustments only to listed pre-0.12 versions. It does not remove current queue PUBLIC table grants. It was read, never invoked or changed.

Supabase documents that its standard NOLOGIN API roles do not expose `net` through the Data API. Therefore this is **not proof of anonymous browser access or a data leak**. Docked's direct-login server application roles still inherit PUBLIC SQL grants when the extension is present, which fails the requested separation. [Supabase permissions documentation](https://supabase.com/docs/guides/database/extensions/pg_net#permissions).

A revoke naming only a Docked role cannot override its inherited PUBLIC grant. Changing unrelated default privileges would not remove existing explicit ACLs. Moving/reinstalling the extension is not a fix for its `net` object grants. A new SECURITY DEFINER wrapper would not remove direct queue access and would expand the security review surface. None was added. Available `postgres` could not change the managed objects in the earlier attempt; no privilege escalation or repeated revoke was attempted now.

## Prepared one-shot operator tool

`scripts/owner-mail-dispatch.mjs` pins one project URL, POST method, exact drain body and existing Svix signing scheme. It refuses redirects, uses a 55-second response budget, bounds response content to 2 KiB and prints only recognized state summaries. It never generates a signing secret, loads a Graph certificate, reads database credentials, calls Graph directly, enqueues an email or retries automatically.

The dispatch path requires a private approval record with a maximum 15-minute remaining validity. **No enabled record was created.** This record documents an actual owner-approved window and operator preflight; it is not independent proof of cloud configuration or a substitute for approval. The server remains the recipient/security authority.

After explicit approval, the operator must read back exact deployed source and flags, confirm `DOCKED_GRAPH_RECIPIENT_MODE=support-test`, no unrelated eligible queued messages, unchanged certificate/application restrictions, closed registration, and pinned protected callback. Only then record the verified preflight in the existing restricted operator directory:

```json
{
  "enabled": false,
  "projectRef": "pojoymtniryarxxunyvz",
  "recipient": "support@docked.com.au",
  "serverRecipientMode": "support-test",
  "queueReviewed": false,
  "ownerApprovalReference": "REPLACE ONLY AFTER EXPLICIT OWNER APPROVAL",
  "expiresAt": null
}
```

Path: `private-data/production/microsoft365/owner-dispatch-approval.json`. This example is deliberately unusable. Do not put credentials in it or commit it. After genuine approval/preflight, use a short expiry and true values, then `node scripts/owner-mail-dispatch.mjs --dispatch-once` for one invocation. One invocation can drain **up to four already queued messages**; approval is not a per-message filter. Do not run it while unrelated messages are eligible. Do not run a timer or repeated shell loop.

Accepted means Graph acceptance, not Inbox delivery. Unknown, unconfirmed, failed, pending, non-200, malformed or timed-out outcomes require operator inspection. The existing durable dispatch fence prevents another worker from resending a dispatched job, including after a lost acknowledgement. Never reset an unknown job to pending. After outcome review, a fresh Auth link is a separate explicit action. At the end of the supervised session close sending/invitation/worker flags, expire the local approval and check that no pending links remain. Do not silently delete audit records.

## Alternatives assessed

| Option | Decision |
| --- | --- |
| One-shot trusted operator trigger | Shortest safe prepared path for supervised owner acceptance; no pg_net required |
| Permanent external server trigger | Suitable direction for unattended service, but host/credential boundary and hosted outage acceptance remain unverified |
| Supabase background task alone | Does not provide durable retry after worker shutdown; retain durable queue and an independent trigger. [Lifecycle limits](https://supabase.com/docs/guides/functions/background-tasks) |
| Synchronous Graph send in Auth hook | Reintroduces the response-deadline failure already addressed by the durable queue |
| Broad PUBLIC/schema revocation or managed-role impersonation | Not authorized; no attempt made |
| New SECURITY DEFINER network wrapper | Does not fix the underlying accessible HTTP queue; not implemented |

## Optional exact Supabase support request

Support intervention is **not necessary for the proposed operator-trigger path**. If database scheduling is preferred, send the following request; it has been prepared, not sent:

> Project pojoymtniryarxxunyvz, organization otldyeunbqabbcjydjpe. Please confirm a supported least-privilege pg_net configuration for a project with custom LOGIN application roles docked_app and docked_beta_app. pg_net is currently absent following rollback of an unused installation; do not enable it or schedule anything without a reviewed change plan. Previously net.http_request_queue was owned by supabase_admin and had PUBLIC all-table privileges. The available postgres role could not change its managed-object ACLs. No queued request or credential disclosure occurred.
>
> Minimum goal: prevent PUBLIC and application roles from reading or mutating net.http_request_queue, its owned ID sequence, and net._http_response, while preserving the extension worker and explicitly authorized postgres scheduler. Please enumerate exact table and sequence dependencies and necessary internal grants for the supported extension version. Propose object-specific ACL changes only; no blanket database/schema/default-privilege changes, managed-role escalation, API-role grant expansion, new SECURITY DEFINER bypass or modification of unrelated extensions. Review service_role needs explicitly. Because role-specific REVOKE cannot negate PUBLIC, the change must address PUBLIC on these exact objects and replace access only for demonstrated internal requirements. Do not assume a SQL-editor retry under postgres can perform the change.
>
> Please confirm maintenance/upgrade behavior so PUBLIC access is not silently restored. Before any activation, return effective has_table_privilege checks for every table operation and has_sequence_privilege checks for SELECT/USAGE/UPDATE for anon, authenticated, docked_app, docked_beta_app (all false), plus intended scheduler/internal access (true only as required). Check outbound invoker functions cannot enqueue under these four roles; review installed function definitions for any definer bypass. Preserve private outbox/RLS denial and non-exposure of net in the Data API. Use a non-delivering test endpoint in an isolated test environment to prove the intended scheduler works and application-role reads/writes fail. Obtain owner approval for any live network smoke test. No new services, plan upgrades, emails or production scheduling are authorized by this request.

## Remaining owner action and acceptance sequence

Validation in this change: 36 focused local tests pass, six real loopback PostgreSQL concurrency/permissions checks pass, TypeScript and changed-source lint pass, and all seven approved policy hashes match. The initial test-only Svix return-value assumption and callback typing were corrected. The generic repository secret-pattern scan flags seven pre-existing fixture files; redacted inspection found test database URL constructions and malformed-key test data, with no finding in the new files. It was not reported as a clean full-repository scan. Detailed evidence: `docs/qa/beta-policy/owner-dispatch-tests.json`. No fresh hosted delivery or positive gameplay claim is made.

1. Owner explicitly approves a supervised support@docked.com.au-only email/owner-account acceptance window using the operator-trigger path. Current instruction expressly prohibits sends and activation; no approval inferred.
2. Operator completes live preflight above, opens only the required owner email flags and confirms the queue quickly acknowledges an Auth request. Retain disabled public signup, external admission and database scheduler.
3. Issue one owner invitation, invoke one drain, read the durable receipt and verify actual Inbox delivery. Owner personally follows the confirmation, sets their password and enrolls TOTP; do not send passwords, seeds or codes in chat. Verify AAL2 before administrator actions.
4. Test recovery, expired/invalid/reused links, session revocation and failure recovery, then persisted owner gameplay and isolation. Do not claim local or simulated tests prove these hosted journeys.
5. Close the supervised sending window. Reliable unattended scheduling, mandatory unresolved policy obligations and external-admission approval remain separate gates before inviting friends. Existing other-real-mailbox negative authorization remains untested.

No request to pay, rotate secrets, broaden Microsoft permissions, modify Preview/Oura, or change the holding page is necessary for this supervised proposal.
