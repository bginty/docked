> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Transactional account email — prepared, not activated

Reviewed 4 October 2026. Recommend **Resend Free** for a small invited beta: $0, advertised 3,000 transactional messages/month, 100/day; cap usage and leave paid overages disabled. Confirm the account's exact allowance before activation. The [official Free-tier announcement](https://www.resend.com/blog/new-free-tier) states the monthly allowance; the [current pricing page](https://resend.com/pricing) confirms the daily cap and current plan features. No account, paid integration, domain record or external email was created by this review.

## Exact owner inputs

1. A Docked-owned Resend account and dedicated sending credential, supplied through server-side secret configuration, never chat or browser variables.
2. Approval for a dedicated authentication sending subdomain (for example `auth.docked.com.au`), exact From address and monitored support/reply address. These are proposals, not active identities.
3. Authorised DNS changes for the provider-issued SPF/DKIM records and a reviewed DMARC policy. Keep existing website/MX records intact; this phase explicitly makes no DNS changes.
4. Approved privacy/terms/operator details, exact beta Auth callback/deep-link allowlist, recipient scope and explicit permission for a real transactional delivery acceptance test.

Supabase supports [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp). Resend's [SMTP settings](https://resend.com/docs/send-with-smtp) are `smtp.resend.com`, port 465 with implicit TLS (or 587 STARTTLS), username `resend`, password the dedicated API key. Put this credential in the exact Docked project's Auth SMTP settings. Domain verification is required; [official domain guidance](https://resend.com/docs/dashboard/domains/introduction). Do not configure Oura or silently disable the current Preview capture hook.

## Activation acceptance

Use only owner-authorised recipients. Verify signup, resend verification, expired/reused links, password reset, changed email, account/security notices, rate limits, bounce/suppression handling, correct redirects on Android/web and account revocation. Keep tokens out of logs and analytics, disable click/open tracking for security links, and rate-limit reset/resend uniformly to avoid account enumeration. Test the existing hook/SMTP precedence explicitly before replacing the safe local sink; a failed capture must never fall back to external sending.

Service verification/reset/security messages are separate from marketing consent. Do not attach promotions, sports tips or newsletters to account mail. Marketing stays opt-in and disabled. `AUTH_EMAIL_ENABLED` is an independent readiness gate; optional alert sending remains off.

Until credentials, verified sender/DNS permission and real-delivery acceptance are supplied, public signup email readiness remains **NOT_CONFIGURED**. Existing invited Preview login and local-safe lifecycle testing remain separate. Closed Google Play testing does not need profitable official Edges, but its real account lifecycle still needs a verified delivery/support path.
