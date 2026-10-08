# Production database provisioned — 8 October 2026

The Fantasy website is **not launched**. The existing holding page at https://docked.com.au still returns HTTPS 200. DNS and all existing Vercel resources are unchanged. This checkpoint supersedes the project-discovery and billing-confirmation blockers at `479ab861`.

## Resources and cost authority

| Resource | Verified state |
| --- | --- |
| Supabase organization | Docked Production, `otldyeunbqabbcjydjpe`, Pro |
| New database project | `docked-production`, `pojoymtniryarxxunyvz`, ACTIVE_HEALTHY |
| Region / database | Sydney `ap-southeast-2`, PostgreSQL 17.11 |
| Creation configuration | Exactly one Micro instance; no high availability, replicas or paid add-ons requested |
| Netlify site | Existing Free site `2292ba6e-7073-4804-b69a-26b41c9a9fb1`, account `6ac753a0bfe95a1bc4d156b9` |
| Netlify deployment/domain | No published deployment or custom domain; staging destination is `https://docked-production.netlify.app` |

The owner explicitly confirmed the organization had **no project**, **Spend Cap ON**, **US$25/month before tax**, and **no paid add-ons**. A fresh exact-organization read verified Pro. Published [Supabase pricing](https://supabase.com/pricing) includes one Micro project within that baseline. The connector's cost operation remains unavailable; actual invoice and Spend Cap were owner-confirmed, not read through the API. No additional paid service or plan was activated. The project was created through the authenticated CLI with explicit organization, Sydney region and Micro size, then independently checked through its exact project ID. No account-wide discovery was performed.

## Database and Auth work completed

- Confirmed the new project had zero application tables and zero Auth users before migration. Applied all **20 existing reviewed migrations**, in version order, using `db push --project-ref pojoymtniryarxxunyvz --skip-vault`. Dry run and completed migration history agree. No separate seed file or Preview database copy was used.
- Verified zero member accounts, cards, financial ledger entries and ownership events after migration. Fictional catalogue definitions exist from the reviewed migrations; no artificial user balance or ownership was issued.
- Enabled database SSL enforcement and read it back. Verified the application connection using the existing public Supabase CA and hostname verification. An initial system-CA-only connection failed correctly; the existing application TLS helper resolved it without disabling verification.
- Provisioned a private `docked_app` login with a generated password and connection limit 10. Verified no superuser, BYPASSRLS, role/database creation or replication capabilities. Owner/admin credentials and privileged API keys remain in ignored local production storage; no secrets were uploaded to Netlify or exposed to clients.
- Applied the explicit [production provider configuration](../config/supabase-production/config.toml) from an isolated CLI work directory, leaving the existing Preview config/link untouched. Subsequent diff reported **zero declared configuration changes** remaining.
- Auth has exact staging/live callback allowlists, 900-second JWTs, minimum password length 12, refresh-token rotation and email verification. Signup and anonymous/phone sign-ins remain closed. TOTP enrollment/verification is available, phone MFA is disabled. **No administrator has yet enrolled or been assigned a production role.**
- Disabled unused storage analytics and image transformations. No SMTP provider was configured, no email was sent and no paid email service was created.

The manifest now records the real project ref and remains `approved: false`. Fantasy remains disabled in its migration-default mode until initialization with the actual production ref and approved policy versions. Do not call `initialize_production` with invented consent versions or enable Preview mode to run production gameplay. The approved starter/daily/seventh-claim configuration is implemented but **not initialized or claimed as verified live gameplay**.

## Tests and remaining limits

[Actual production prelaunch evidence](qa/fantasy-production/provisioned-prelaunch-check.json): **12 checks passed** through a real TLS-authenticated runtime database connection and the public Auth/Data APIs. These cover least privilege, RLS on every application table, denied raw ownership/financial/Auth access, denied reward rewrite and production initialization, rejection of an unauthenticated starter command, email-verification/closed-signup settings, no anonymous profile disclosure and non-exposure of private/Fantasy schemas. The local rerunnable checker is `private-data/production/prelaunch-check.mjs`; it creates no accounts or game records.

Supabase security advisor reported **66 informational RLS-without-policy findings, no WARN or ERROR findings**. These correspond to intentionally denied direct access to private tables, with reviewed server entry points. Do not add permissive policies merely to remove informational notices. See [Supabase's explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

These checks do not establish successful signup, email verification/recovery, administrator MFA enrollment, starter/daily/seventh claims, cross-account concurrency, frontend behavior or Netlify runtime compatibility. Earlier local PostgreSQL concurrency tests remain separate evidence. No native Android or iPhone testing occurred here. No new security reviewers or model-effort switches were used.

The focused production-isolation, Netlify identity, source-provenance and release-tool regressions passed **14/14**. Changed-file credential scanning passed across **7 files**, with zero findings/errors, using the actual new production secrets privately as additional match values; no Preview credentials were loaded. `git diff --check` passed. No gameplay source or SQL migration changed, so historical broad suites were not rerun as a substitute for the remaining hosted tests.

## Exact remaining actions

1. **Owner contact facts:** the owner selected `support@docked.com.au`. Confirm it is monitored and can handle support/privacy requests, and supply the current publishable business/correspondence address. Do not publish the historical address as current.
2. **Mail access:** identify/connect the existing authorized sending provider for verification and password recovery, and a controlled receiving inbox. Supply credentials through secure local/provider configuration, never chat. Microsoft 365 DNS alone does not establish SMTP access. Public signup stays closed until actual delivery is tested.
3. **Policies:** finalize the [policy draft](FANTASY-PRODUCTION-POLICY-DRAFT.md), including contact, retention/complaints and processor facts, and approve actual policy versions. Then initialize the production game with those versions and verified project ref; enroll the real administrator with TOTP.
4. **Acceptance and deployment:** finish genuine hosted signup/recovery, permissions, atomic pack/reward/concurrency and responsive browser tests against this project. Stage on the existing Netlify Free site only after its preparation gates are satisfied. Promote DNS only after all critical checks pass, preserving the holding-page rollback and mail DNS.

Preview, Oura and existing Vercel resources were **not accessed or modified** in this run. This is preservation by leaving them untouched, not a new live Preview acceptance result. Existing Edge source and migrations remain preserved; authenticated Edge acceptance is still pending.

Barry's APK and ready-to-send email remain on the Desktop as previously verified. No new Gmail connection or send confirmation was provided; **email delivery is not complete**. The previously prepared private link expires 11 October 2026 at 10:36:46 am Sydney; reverify it before any later distribution.
