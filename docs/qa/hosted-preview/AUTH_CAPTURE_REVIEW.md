# Hosted Auth capture design and proof procedure

Scope: only Docked Preview `bckkllmndoxzpzdqrevb`, organisation `ernfnkcbalhyqpsrzdwa`, standard PG17 in Sydney. Setup is outside application migrations and starts disabled. This document does not claim deployment or successful GoTrue delivery.

The reviewed design uses a PostgreSQL Send Email Hook, which executes inside the project rather than calling an external transport. The single-jsonb function runs as `supabase_auth_admin`; it has a fixed empty search path, explicit grants and RLS, and remains SECURITY INVOKER. The role can read configuration/allowlists and insert captures, but cannot read, update or delete captured credentials. The setup revokes browser, PUBLIC and service-role access; no new API schema is exposed. [Auth Hooks security model](https://supabase.com/docs/guides/auth/auth-hooks)

`setup-auth-capture.sql` requires an explicit connection acknowledgement `docked.preview_project_ref=bckkllmndoxzpzdqrevb`. This prevents accidental installation without the reviewed step; it cannot replace independently verifying the project's metadata and connection. It refuses to overwrite an existing schema.

## Allowed input and stored data

- Configuration expires within 24 hours; it is disabled initially.
- Every address must match `docked-preview-[a-z0-9][a-z0-9-]{0,63}@example.invalid` **and** have its own unexpired, non-revoked row in `preview_auth.allowed_recipients`. No wildcard approval exists.
- Only signup and recovery actions are accepted. A requested email change is rejected.
- The application's site URL is exactly `http://localhost:3000`. Redirect is exactly `/auth/callback` or `/auth/callback?next=/reset-password` on that origin. Extra parameters, alternative origins, external destinations and encoded substitutions fail closed. GoTrue's hook payload field `email_data.site_url` instead identifies its external Auth API base: it must be exactly `https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1`, with no other host, path, query or fragment. Root independently verified this exact base from a genuine provider-generated action link's safe origin/path metadata.
- Payload size is capped. Captures store the real token hash, action, address, Auth user ID, redirect and timestamps. They do not store raw OTP, complete payload, passwords or JWTs. Each capture expires within 30 minutes and cannot outlive its recipient/configuration approval.
- Both ordinary and PKCE token hashes are accepted: an optional `pkce_` prefix followed by 40–256 lowercase hexadecimal characters. The prefix is preserved for the real GoTrue verification flow. PostgreSQL checks the prefix and length separately because its regex repetition bound cannot exceed 255. [GoTrue verification implementation](https://github.com/supabase/auth/blob/master/internal/api/verify.go)
- Successful capture returns `{}`. Rejections return a generic hook error. No network, SMTP, Edge Function, extension or email provider is invoked by this implementation.

During integration, `upgrade-auth-capture-diagnostics.sql` can replace only the capture function with the reviewed implementation and exact grants. It invalidates any prior proof. Rejections identify a static field category (for example `site_url` or `token_hash_format`), never its submitted value or credential fragment. A new real canary is required after the change.

Supabase documents that an enabled Send Email Hook handles email instead of SMTP. Hook errors must fail the Auth operation; disabling the hook while the email provider remains enabled restores SMTP behavior, so never disable it as a troubleshooting shortcut during enabled signup. [Email hook behavior](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)

The initial hook incorrectly compared `email_data.site_url` with the app's loopback site. Source review established that GoTrue populates it from `getExternalHost(...).String()` instead of the configured app SiteURL. This contract correction keeps both boundaries exact: the provider URL belongs to this Docked project, and the actual redirect remains loopback. [GoTrue hook payload construction](https://github.com/supabase/auth/blob/master/internal/api/mail.go)

## Required proof before opening the application gate

1. Independently verify project identity and inspect the installed function/grants using `assert-auth-capture.sql`. No assertion selects credentials.
2. Add only the exact reserved QA addresses, with explicit expiry. Enable capture configuration with a bounded expiry. Configure the remote Send Email Hook URI `pg-functions://postgres/preview_auth/capture_email` and verify its saved enabled setting. Confirm external SMTP and unrelated hooks were not activated.
3. While Docked's application signup gate remains closed, use the real GoTrue signup API for one separately approved canary. Confirm a real Auth identity and fresh capture exist, with the expected action/redirect; inspect only safe metadata in reports. The capture function's return must not expose token data. A rejected/unlisted reserved test alias must produce a hook error with no capture and no SMTP fallback.
4. After inspecting those actual results, the operator records `configuration.hook_verified_at`, `hook_verified_event_id`, and `hook_function_sha256`. Obtain the fingerprint with `encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex')`. Do not populate proof fields merely because setup SQL succeeded.
5. The app gate additionally requires the still-unexpired canary capture, active proof recipient, matching configuration/project/site, current function fingerprint and the exact target email approval. This closes automatically when the 30-minute proof expires. Renew a real canary proof if a long test run requires it.
6. Only then enable the dedicated preview application's registration flag and use its actual signup → original-browser PKCE callback → verification → login/recovery paths. Email transport is deliberately capture-only; never label this external email delivery.

Root-approved QA roster: `docked-preview-<alias>-20261003@example.invalid`, where alias is exactly `member-a`, `member-b`, `restricted`, `analyst`, `editor`, `admin`, or `auditor`. A separately named canary needs its own explicit row. No test is permission to approve a real jurisdiction or fabricate sporting data.

## Private browser-test mailbox

The root-operated `scripts/hosted-preview-mailbox.mjs` is a read-only database exporter. Run with the ignored `.env.local` and exact approved email arguments; it refuses non-preview configuration, a different project/endpoint, missing proof or expired/unlisted addresses. It writes only `private-data/hosted-preview/mailbox.json`, already ignored by Git, and emits no credentials.

Its readiness input is ignored `private-data/hosted-preview/readiness.json`:

```json
{
  "projectRef": "bckkllmndoxzpzdqrevb",
  "siteUrl": "http://localhost:3000",
  "authHookUri": "pg-functions://postgres/preview_auth/capture_email",
  "hookVerifiedAt": "ACTUAL_DATABASE_PROOF_TIMESTAMP",
  "hookFunctionSha256": "ACTUAL_VERIFIED_FUNCTION_HASH",
  "expiresAt": "ACTUAL_PROOF_EXPIRY_TIMESTAMP"
}
```

The output envelope is `{projectRef,exportedAt,messages:[{email,type,receivedAt,tokenHash,redirectTo,expiresAt}]}`. The browser reader accepts only a fresh matching recipient/action after its own request began, then follows the real GoTrue confirmation URL in the original PKCE context. Never replace it with an admin-generated link or invented session. The operator refreshes this export while the guarded suite waits; no polling process is started by the exporter itself.

## Retention and teardown

Run owner-only `preview_auth.purge_expired()` periodically during the acceptance window and in test teardown. It erases expired captures and captures whose recipient/configuration has expired or been revoked, then removes unused inactive address rows. The Auth service has no purge permission. No cron extension or scheduled job is installed by setup; the operator must provide a protected worker/runner cadence before claiming automated physical retention. TTL and read filters prevent use of expired credentials but do not themselves erase database rows.

At the end, disable application/hosted signup as appropriate, set capture configuration disabled, purge, and remove the local mailbox/pending files using their exact workspace paths. Keep only sanitized proof metadata and test results. Keep the hook configured to reject if any path could otherwise fall back to external SMTP. Account cleanup must use real Auth administration and Docked erasure paths, not direct invented/deleted Auth-schema fixtures.

Local tests cover installation acknowledgement, disabled default, role grants/RLS, secret-free success output, dedupe, exact address/site/redirect/action restrictions, expiry/revocation, retention purge and SQL compatibility. Hosted hook execution and configuration remain separate required evidence.
