> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Transactional email for 10,000+ Docked members

Recommendation prepared 9 October 2026. Research and design only: no service, subscription, permission, DNS, rate-limit or sender configuration was changed. This is separate from the current supervised owner-only Graph test.

## Recommended direction

Keep Microsoft 365 support@docked.com.au for human support and the already restricted beta integration. For wider membership, evaluate **Amazon SES transactional sending with usage pricing**, retaining the existing signed Auth hook, private encrypted outbox and auditable state transitions. Do not replace the currently tested transport until the owner approves the provider, budget and implementation and new delivery acceptance passes.

Microsoft documents mailbox sending limits and says Exchange Online is not suited to bulk mailing. A mailbox's nominal recipient ceiling is not a deliverability promise or guaranteed capacity for a large registration burst; tenant external-recipient controls can also apply. [Exchange Online limits](https://learn.microsoft.com/en-us/office365/servicedescriptions/exchange-online-service-description/exchange-online-limits)

Azure Communication Services Email would otherwise be a Microsoft candidate, but the current Microsoft lifecycle guide lists Email for retirement on30 September 2028 and describes onboarding/expansion restrictions beginning23 October 2026. I would not select it for a new long-lived Docked email integration without resolving that lifecycle risk. [Microsoft lifecycle guide](https://learn.microsoft.com/en-us/azure/communication-services/acs-retirement-and-breaking-changes-guide)

## Capacity and cost assumptions

Member count alone is not a sending requirement. Establish expected monthly Auth/security messages, busiest-hour registrations and acceptable recovery latency. An illustrative planning case is 50,000 messages/month for 10,000 members, with a separately agreed peak. It is a sizing example, not observed demand or an approved budget.

SES lists usage-based outbound mail at **US$0.10/1,000 emails**: approximately US$1 for 10,000 messages or US$5 for 50,000, before data charges, taxes, event processing, logs, worker hosting and any other AWS usage. Avoid dedicated IPs, optional deliverability add-ons and paid bundles unless justified and separately approved. These are base transport examples, not an all-inclusive monthly quote or spending cap. [SES pricing](https://aws.amazon.com/ses/pricing/)

New SES accounts start in a sandbox with 200 messages/day, 1 message/second and verified-recipient restrictions. Production access and the required regional sending quotas must be approved before claiming suitability for 10,000 members. Regional domain verification, quotas and suppression configuration are separate. Evaluate an Australian region and document processing locations; region selection alone does not promise all email data remains in Australia. [Production access](https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html), [regional configuration](https://docs.aws.amazon.com/ses/latest/dg/regions.html)

The existing Supabase **2 emails/hour** is independently too low for scale: at that rate,10,000 single-email invitations alone take 5,000 hours. Changing delivery provider does not remove the configured Auth limit. A future owner-approved, abuse-tested increase is required; leave every existing rate limit and IP-forwarding setting unchanged now. [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

## Proposed integration and security requirements

1. Reuse the existing signed Supabase Send Email hook and encrypted transactional outbox. Add a narrowly scoped SES transport behind a provider interface; preserve the Graph implementation for controlled rollback without sending the same job through two providers. Never silently fall back after an uncertain submission.
2. Replace manual dispatch only after approval with a least-privilege server-controlled worker. Evaluate included hosting capacity first. No application-role pg_net access, no broad database grants and no privileged key in the browser. Review throughput and queue capacity: current bounded beta batches are not scale acceptance evidence.
3. Preserve stable message identities and an atomic dispatch fence. Authentication links expire, so reject stale jobs and alert on queue age rather than building an hours-long backlog. For network timeouts after submission, hold the uncertain state for reconciliation. Do not assume SES offers an idempotency guarantee or that an SDK's automatic retry is safe; explicitly control provider retries.
4. Validate signed delivery/bounce/complaint events, correlate provider message IDs, maintain suppression lists, and distinguish submission acceptance from receiving-server delivery and actual Inbox placement. Disable click tracking/link rewriting for Auth links. Test major mailbox providers with authorised recipients before expansion.
5. Verify the sending domain, aligned SPF/DKIM/DMARC and a dedicated bounce/MAIL FROM subdomain. Preserve Microsoft 365 inbound MX and existing DNS services. Keep reply-to support@docked.com.au. Domain and identity changes require a concrete reviewed rollout.
6. Use the narrowest supported sender permission and secure server credential storage. Review data processing terms, locations, deletion and log retention; never log Auth tokens, links, certificate material or full message bodies. Separate operational email from marketing consent and reputation.
7. Add per-account and global abuse controls, provider-quota backpressure, queue-age alarms and an application budget circuit breaker. Billing alerts alone are not a hard spending cap. Invite gradually; reserve capacity for password recovery and security notices.

The Send Email hook supports a custom sending implementation, so this preserves Supabase Auth rather than creating separate accounts or a parallel identity system. [Supabase Send Email hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)

## Approval and evidence needed before implementation/activation

- Owner selects provider and approves a specific monthly budget plus any ancillary services; a base-price estimate is not authorization to provision.
- Confirm production SES access and adequate regional quotas, sender identity, processing terms and domain configuration. No AWS account or existing resources were inspected for this recommendation.
- Approve future Supabase email-quota changes explicitly after sizing and abuse review. Keep other login/verification limits and IP forwarding under separate security review.
- Review the worker architecture and migration/rollback, then run real delivery, safe-failure, concurrency, expiry, suppression and budget-stop tests. No mass emails to real members as a load test.
- Close existing owner-authentication/MFA acceptance first. A scaling design does not resolve or waive that gate.
