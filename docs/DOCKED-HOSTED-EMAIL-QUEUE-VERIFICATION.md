> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Docked hosted email queue verification

8 October 2026. Continued from `8e7852e0` on `pivot/fantasy-cards-preview-v1`. **Controlled hosted delivery PASS; complete hosted authentication acceptance BLOCKED. Public signup and automatic production email remain disabled.**

## Verified results

| Check | Result and limits |
| --- | --- |
| Existing certificate/key match | PASS. Existing certificate and PS256 application-only authentication reused; no rotation or new long-lived credential. |
| Effective Entra application grants | PASS. Exact Docked service principal query returned HTTP 200, zero assignments, no next page. Token has no application-role or delegated-scope claims. |
| Exchange scope | Administrator evidence: support-only `PrimarySmtpAddress` filter, scoped Application Mail.Send, support InScope=True. No independent agent Exchange administrator session. Other-mailbox negative test remains NOT RUN. |
| Hosted queue and Graph acceptance | PASS. Eight concurrent signed enqueues produced one record. Two concurrent workers produced one Graph 202 and one idle result. Repeated drain stayed idle; receipt has one attempt and one dispatch event. |
| Actual delivery | PASS. Owner confirmed **Received in Inbox** for **Docked hosted email queue check ded93c7bd111**. Graph 202 alone was not treated as delivery. |
| Hosted latency | Enqueue 794–895 ms, worker certificate authorization 163 ms, Graph response 347 ms, worker total 806 ms. One controlled sample, not a load or long-term reliability guarantee. |
| Real PostgreSQL concurrency | PASS. Isolated PostgreSQL 17.10: 24 concurrent enqueues → one receipt; 24 claims → one lease owner; no reclaim after dispatch; forbidden retry transitions denied. Six scenarios. |
| Production queue security | PASS. Actual anonymous, member and application-runtime roles cannot read or operate queue; both tables have RLS; public Data API RPC denied. Accepted encrypted payload erased. Migration recorded once. |
| Actual Auth invalid links | PASS for fabricated signup/recovery tokens: HTTP 403 `otp_expired`, no session. This is **not** proof of a genuinely expired previously valid link. |
| Account/data impact | No Auth users, sessions or cards before or after tests. Only the authorized diagnostic mail receipt/events were created. |
| Production signup, invitation, confirmation, recovery and expired-link journey | BLOCKED / NOT RUN end to end. Staging is 404 and Auth Send Email hook remains disconnected. Invitation action is deliberately unsupported by the current PKCE-only callback. |
| Mail failure and Auth transaction consistency | Queue failure tests PASS locally; actual Auth rollback, pending-account reconciliation, retry and recovery behavior remain BLOCKED pending the controlled hosted Auth test. No claim that every provider failure is reconciled. |
| Regression and security | 399 platform tests PASS; seven focused queue SQL tests PASS; six real PostgreSQL scenarios PASS. Typecheck and changed-file ESLint PASS. Dependency audit: zero vulnerabilities. Exact-project Supabase security advisor: no issues. Secret scan recorded separately. |

Evidence: [hosted requests and Inbox confirmation](qa/fantasy-production/hosted-mail-queue.json), [actual production security/Auth checks](qa/fantasy-production/hosted-mail-security.json), [deployed source and disabled flags](qa/fantasy-production/graph-queue-deployed-readback.json), [real PostgreSQL](qa/fantasy-production/auth-mail-postgres.json), [fresh Microsoft identity/grants](qa/fantasy-production/graph-application-preflight.json).

## Timeout finding and implementation

The earlier four-second deadline was shared by certificate authorization and Graph send. The owner-confirmed earlier Inbox receipt proves dispatch and eventual acceptance, but there was no captured Graph response or stage timing to establish precisely whether Microsoft accepted before or after the local deadline. A narrowly scoped Exchange trace can help establish service receipt timing; it cannot reconstruct the missing client network response. No speculative root cause is claimed. The new hosted sample did not reproduce a slow Graph response.

The signed Auth endpoint now only commits an encrypted outbox batch, within its three-second database request budget. It never calls Graph synchronously. A separate signed worker obtains the certificate token (ten-second budget), durably records dispatch, then waits up to twenty seconds for Graph. This removes the old four-second Graph dependency from Supabase's five-second HTTP hook budget. A delayed enqueue acknowledgement can return an error even after commit; the same logical link is deduplicated when retried.

Job identity is an HMAC of mode, recipient, action and token, independent of webhook ID and encryption nonce. AES-GCM payload encryption and HMAC identity use separate HKDF purpose keys derived from the existing hook secret. No plaintext email body or Auth token is stored in the outbox. Service-role-only RPCs use fixed search paths, locked rows, worker leases and compare-and-set state transitions. Auth retries reuse existing receipts; conflicting content fails closed. The two-message email-change enqueue is atomic, though delivery to two recipients cannot be atomic.

A pre-dispatch authorization failure can retry after sixty seconds, up to three claims. Once dispatch is recorded, timeout/disconnect/5xx/429 or an uncertain receipt write is held as `unknown`, never automatically resent. A crashed dispatched job becomes unknown when swept after its ninety-second lease. Explicit 202 is accepted; specific explicit 4xx rejections fail. This is conservative at-most-one submission per job, **not a claim of exactly-once delivery by Microsoft**. Unknown jobs require operator investigation; do not reset them to pending. A new Auth request may intentionally create a new token/job, subject to existing Auth rate limits.

Terminal payloads are erased. Pending envelopes expire after fifteen minutes when a claim/status sweep runs; there is currently no active scheduled sweep. Receipt/event retention, scheduled cleanup and monitoring must be settled before activation. Do not rotate the existing hook secret while encrypted pending work depends on it without a separately reviewed migration.

## Deployed state and preservation

- Supabase organization `otldyeunbqabbcjydjpe`, project `pojoymtniryarxxunyvz` only.
- Additive production-only migration `config/production-email/supabase/migrations/20261008121711_docked_auth_email_outbox.sql`. It is intentionally outside Preview's migration directory. Applied through an isolated workdir containing existing history plus this migration; no seed, Vault update or role replacement.
- Function `docked-auth-email`, ID `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, final readback version **4**, bundle SHA-256 `2b1951b7e9a04c3a4a29f7cac571ed4560756bd964d2b0de7ecc246a91ee28e6`. All four downloaded source files match local source after line-ending normalization.
- Existing certificate/private key and application IDs are now configured as protected Edge Function secrets. They were not exposed to a browser, printed, committed, regenerated or uploaded to another provider. This supersedes earlier reports that hosted Microsoft credentials were absent.
- Final remote digests verify `DOCKED_GRAPH_MAIL_ENABLED=false`, `DOCKED_GRAPH_WORKER_READY=false`, `DOCKED_GRAPH_TEST_ENABLED=false`. Signed controlled requests now fail closed. The production Auth Send Email hook was not connected or enabled; no public email activation occurred.
- Production enqueue and `/worker` independently require both production flags. There is no active production scheduler. `/control` additionally requires a valid signature and the controlled flag, and fixes diagnostic sender/recipient to support.
- Holding page HTTPS 200; www 301 redirects to apex. Netlify staging remains HTTP 404. No website deployment, DNS or holding-page edits.
- Oura, Preview and Vercel were not accessed or modified. Their live functionality was not retested. No paid service or plan was changed. Existing owner-confirmed US$25/month baseline remains the budget; current invoice/usage totals were not independently audited.

One bounded read-only Astra High review examined queue foundations and revised gates, with no nested delegation, edits or shared/cloud test data changes. The main agent implemented the fixes and ran the tests. No Ultra audit or main-agent model switch is claimed.

## Exact remaining actions before launch approval

1. **Owner confirmation already received:** hosted diagnostic arrived in Inbox. No further diagnostic resend is needed.
2. **Owner/legal approval:** approve the actual policy/territory/retention versions and operating responsibilities required by the existing production preparation gate. Do not invent approval flags to deploy staging. The private correspondence address stays private.
3. **Owner authorization required:** authorize a tightly controlled hosted Auth test window and connection of the signed Send Email hook for the approved support test account only. This request is necessary because the latest instruction expressly prohibits activating production email or public signup without approval. Public registration need not be opened for an invitation test; any registration test requires an explicit controlled-access design and approval. No new Microsoft permission is needed.
4. **Implementation after prerequisites:** deploy the protected Netlify staging app; add a reviewed invite-token confirmation/session route (the existing callback accepts PKCE code only); configure and test the signed worker scheduler, cleanup and failure monitoring within existing resources. Do not set WORKER_READY true merely because the manual worker test passed.
5. **Actual acceptance still required:** receive the invitation/confirmation/recovery emails, complete browser session and password changes, verify invalid/reused/genuinely expired links, then inject pre-enqueue failure and post-enqueue Graph failure to verify Auth account/session state and recovery. Pending/unconfirmed users must never gain a session or cards; failed profile provisioning must be reconciled after ownership proof. Test the two-address email-change journey only with separately authorized addresses.
6. **Microsoft administrator, only if exact historical timing is needed:** run the existing subject/time-restricted MessageTraceV2 command in [the read-only audit guide](DOCKED-EXCHANGE-READONLY-AUDIT.md). Preserve the documented other-mailbox negative-test limitation until a real authorized second mailbox exists; do not purchase one or expand permissions to manufacture a pass.

A transport delivery pass is not launch approval. Keep public signup, automatic mail, marketplace/payments and domain promotion closed until the remaining gates pass.

Sources: [Supabase HTTP Auth hook deadline](https://supabase.com/docs/guides/auth/auth-hooks), [Send Email hook contract](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook), [Graph sendMail 202 acceptance semantics](https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0).
