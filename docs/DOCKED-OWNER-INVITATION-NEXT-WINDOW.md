# Next supervised owner invitation — waiting for fresh approval

**Window completed:** The owner explicitly replied “yes” immediately before the21:58Sydney attempt on9October. Auth returned200 and the sole owner identity was verified before dispatch. Graph accepted one invitation (202, attempts1). All dispatcher flags are OFF and both local approvals are disabled/consumed. No retry occurred. Subject: “Your Docked invitation”. Await actual Inbox confirmation before claiming delivery or proceeding with personal confirmation/MFA. No recovery email was requested. The new one-shot marker is consumed and must be preserved.

Recorded 9 October 2026. This is a preparation record, not permission to send and not an enabled dispatcher configuration.

## Owner-confirmed settings

The owner manually verified the dedicated Docked production project's settings:

- Email sending: 2 emails/hour.
- Signups/sign-ins: 30 requests/5 minutes/IP.
- Token verification: 30 requests/5 minutes/IP.
- IP address forwarding: disabled.

Source: owner's message in this conversation, not an agent Management API readback. No rate limit or security setting was changed.

The previous operator receipt began at 09:25:56 UTC. Supabase Auth logs timestamp the actual 429 `over_email_send_rate_limit` at **09:26:05 UTC / 20:26:05 Australia/Sydney**. Scoped logs through 09:49 UTC showed this request and no later requests on the inspected email-producing Auth routes. Logs are evidence with ingestion limits, not a guarantee that nobody can make a later request.

## Earliest recheck and approval

**Not before 21:30 Sydney, Friday 9 October 2026 (10:30UTC).** This is a conservative operator wait of more than one full hour after the last observed rejection. It is not a provider-confirmed reset. Any newer email-producing request requires reassessing the wait. Do not probe quota availability with an invitation, signup, recovery, resend or OTP request.

No automatic retry, reminder, scheduled send or automatic wake-up has been created. The owner should return when present and ready at or after that time. The operator must refresh read-only project, deployment, signature/certificate, grants, callback, closed-registration, empty-outbox and zero-owner-account checks. The previous hosted preflight and grant audit are stale for a new send; do not edit their timestamps to reuse them.

Immediately before any sending, present this single concrete approval request:

> Approve one supervised invitation to support@docked.com.au on the protected staging deployment dpl_5fADFGCKB9LGuwMLxjjE1cqjVZ4y now? This permits one Auth invitation request and, only after verifying the created owner account and exactly one expected queued invitation, one signed Graph dispatch. No confirmation or recovery email is included. The dispatcher will be disabled immediately afterward; any429, failure or uncertain outcome stops the attempt without retry.

This wording must be refreshed if the verified deployment changes. Earlier broad approval does not replace the user's new requirement for immediate explicit approval. Silence or elapsed time is not approval.

## Prepared single-request scope

Recipient: support@docked.com.au only. Existing Graph certificate and support-mailbox restriction. Dedicated project `pojoymtniryarxxunyvz`. Existing protected staging URL: https://docked-production-i8koncmem-briant-s-projects.vercel.app

Maximum Auth invitation requests: **1**. Maximum invitation Graph submissions: **1**. No recovery request in the same action. Keep all prior attempt markers and receipts. The current three operator modes are consumed and deliberately refuse replay; do not erase them. A separately bounded new attempt must retain those guards and record the fresh approval before execution. No new replay path or executable send approval was enabled in this preparation.

Following approval, reconcile a successful Auth response against the exact owner identity and expected pending invitation before dispatch. If Auth outcome or Graph acceptance is uncertain, stop and inspect; do not resend. Disable all sender/worker/invitation flags and local approval in mandatory cleanup, verify shutdown and record the receipt. Then request actual Inbox confirmation. Account creation, email acceptance, Inbox delivery, account confirmation and MFA are separate acceptance steps.

Personal confirmation, password choice and MFA enrollment remain owner actions. Recovery needs a later explicit sending approval and quota assessment; do not consume the second hourly slot as an unsolicited test. External testers, public signup and gameplay activation remain gated. No owner identity, code or MFA factor exists yet.

## Read-only state verified during preparation

All mail switches false; public signup disabled; email provider enabled with confirmation required. Database: users 0, factors 0, admissions 0, outstanding mail 0, cron jobs 0, scheduler false, testers false, net schema absent. No email or Auth mutation was requested this turn. No DB grants, Microsoft permissions, certificates, paid services, domains, holding page, Oura or existing Docked Preview were changed.

See [the prior acceptance report](DOCKED-SUPERVISED-OWNER-AUTH-2026-10-09.md) for the deployed fixes, tests and unresolved acceptance steps, and [the scale recommendation](DOCKED-EMAIL-SCALE-RECOMMENDATION.md) for future production delivery.

## Owner returned: preflight refreshed at 21:56 Sydney

On 9 October, the owner returned after the conservative cooldown. Read-only checks found no subsequent email-producing Auth requests through 10:55 UTC, no user/admission/MFA/pending mail, and all dispatcher switches closed. Certificate/grant checks passed at 10:55 UTC; all 9 protected hosted checks passed at 10:56 UTC. No quota reset guarantee is claimed.

Prepared `--send-owner-invite-after-quota` with a new retained one-shot marker, exact recipient/project/deployment binding and explicit owner approval no older than 5 minutes. Missing approval was tested and rejected before credential loading or network access. No approval file was created and no email was sent. The operator must record the next explicit owner message before executing; “I am back” is not send approval.
