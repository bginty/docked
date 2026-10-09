> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Docked production release — 4 October 2026

The owner explicitly authorised replacing the existing docked.com.au storefront with the new Docked application and improving it after launch. This supersedes earlier instructions prohibiting production deployment and website DNS changes. It does not approve purchases, invent operator details, validate the strategy or authorise external test emails.

The owner subsequently explicitly requested deletion of the current old site because it will not be used again. The authorised immediate step is removal of the public storefront and replacement with a neutral Docked transition page on the existing GitHub Pages hosting. Preserve repository history and existing customer support; do not use the retired storefront as a future public rollback target. The new application remains a separate production release.

## Public storefront retirement completed

The neutral transition page is now live at **https://docked.com.au/**. GitHub Pages run [37156304851](https://github.com/bginty/docked/actions/runs/37156304851) succeeded for `main` commit `baf3c87611eee8f45ca08ad3649242739b1f1a34`. The first retained live browser receipt is 4 October 2026 at 08:50:44 Sydney time (3 October at 21:50:44 UTC). The old storefront, checkout scripts and product assets are removed from the deployed output; retired HTML routes show the transition page and removed product assets return 404. Repository history and the inherited existing-order support link are preserved.

Live checks passed at 320, 412 and 1,440 pixels with no accessibility violations, console errors, broken images or horizontal overflow. Independent HTTPS verification at 08:54:16 Sydney confirmed `www` returns 301 to the canonical apex. Existing GitHub Pages DNS and email records were not changed. The static source explicitly disables Vercel Git deployments; the separate Docked Preview alias still serves application source `38f90a13b5cd8834460b1ecdd6e2ff61ec949dd0`, with no deployment of the static retirement commit. See [retirement evidence](qa/production/retirement/README.md).

**The new Docked application is not yet in production.** The public transition page makes no launch-date or validated-performance claim. Its Preview link is optional and labelled; it does not redirect public visitors into the test environment. Dedicated application hosting/database, operator/policy details and the release gates below remain pending.

## Release scope

Release the current branded web/mobile experience, education and honest research-pending surfaces. Keep sporting-data polling, scanner, forward paper, official publication, optional outbound messages and commercial features disabled. An API key alone must not activate these features. Public account creation additionally requires a dedicated production Auth/database, approved policy versions, ordinary regional feature approvals and working transactional verification/recovery delivery. Preview invitations and test accounts are not production accounts.

The existing Android v5 package still points to Docked Preview. A website cutover does not silently convert that installed APK into a production client; the separately signed production Android release remains a later operation.

## Verified pre-cutover state

- Application branch: `codex/docked-value-platform`; initial source `00089c5899b1d0126a03306a9210641be933aeb4`.
- Old storefront: `main` / GitHub Pages, source `6086b28690b28cc5df01d521982bfa4d4e6d02a8`.
- Current apex A records: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`; recorded TTL 600 seconds.
- Current `www` CNAME: `bginty.github.io`; recorded TTL 3,599 seconds.
- Authoritative nameservers: `ns35.domaincontrol.com`, `ns36.domaincontrol.com` (GoDaddy). Keep nameservers and email DNS unchanged during the website cutover.
- Docked Preview Vercel: `prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR`, team `team_tf6xweKKyVCj9bTppUKttJ4l`. Read-only inspection found a GitHub connection to `bginty/docked`, production branch `main`, and Preview-scoped variables only. The earlier disconnected-project screenshot is now historical.
- `THE_ODDS_API_KEY` now exists as a sensitive Preview-only variable. Its value was not retrieved, printed or copied to production. Provider activation remains independently gated.
- Existing Vercel team is Hobby. [Vercel's fair-use rules](https://vercel.com/docs/limits/fair-use-guidelines) restrict Hobby to non-commercial personal use. A dedicated paid Docked hosting scope requires owner choice and exact checkout approval. [Published Pro pricing](https://vercel.com/pricing) starts at US$20/month, with usage charges possible; no purchase was made.
- Docked Supabase organisation: `ernfnkcbalhyqpsrzdwa`, Free. Existing Preview: `bckkllmndoxzpzdqrevb`, Sydney. Tool quote for a separate project: $0/month; explicit creation cost acknowledgement requested. Do not repurpose Preview or the unrelated Oura project.

Private metadata receipts are under `private-data/production`. They are not deployable assets or source-controlled secrets.

## Production configuration

`config/hosted-production.json` starts unapproved with no fabricated project IDs. Populate it only from verified production resource identities. The build/runtime guard checks the reviewed Vercel project, exact Supabase project, Sydney database host and role, canonical origin, actual source commit and closed feature flags. Preview/production cross-binding remains an error.

Use server-only, Production-scoped credentials. Never copy the Preview environment wholesale. Required settings include:

| Purpose         | Variables / configuration                                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Target          | `APP_ENV=production`, `SUPABASE_ENV=production`, `DOCKED_HOSTED_PRODUCTION=true`, `DOCKED_HOSTED_PREVIEW=false`, `SITE_URL=https://docked.com.au`                                     |
| Database/Auth   | Separate `DATABASE_URL`, `DATABASE_CONNECTION_MODE=session`, `DATABASE_RUNTIME=serverless`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` |
| Provenance      | Platform-provided `VERCEL_PROJECT_ID` and full `VERCEL_GIT_COMMIT_SHA`; manifest IDs must match the actual resource                                                                   |
| Operator        | Verified `DOCKED_LEGAL_NAME`, `DOCKED_ABN`, `DOCKED_SUPPORT_EMAIL`, optional `DOCKED_SUPPORT_URL`; `LEGAL_ENTITY_VERIFIED=true` only after actual verification                        |
| Policies        | Owner-approved `TERMS_VERSION` and `PRIVACY_POLICY_VERSION`; never substitute a production-looking label for document review                                                          |
| Accounts        | `REGISTRATION_ENABLED=false`, `AUTH_EMAIL_ENABLED=false` until separate database registration authority, regional policies and transactional SMTP readiness pass                      |
| Closed features | Every flag in `productionDisabledFlags` in `src/core/hosted-production.mjs` explicitly `false`                                                                                        |

The publishable Auth key may reach the browser. Database, service-role, provider, email and worker credentials may not. The existing public CA remains traced into the server bundle; certificate and hostname verification stay enabled.

Supabase's [default email service is not intended for production](https://supabase.com/docs/guides/auth/auth-smtp) and restricts recipients. Supply a dedicated transactional SMTP provider, verified sender domain and exact production callbacks before enabling public signup/recovery. Configure confirmation required, anonymous signup disabled and staff MFA. Marketing delivery remains separate and disabled. No external test email is authorised by this runbook.

## Provisioning and release sequence

1. Verify the chosen paid hosting team and create only `docked-production`. Record its actual team/project IDs; expose Vercel system environment variables. Keep the old Pages source and Preview project intact.
2. After the quoted cost acknowledgement, create `Docked Production` in the existing Docked Supabase organisation, Sydney, standard PostgreSQL. Verify organisation, name, reference and region before any migration. Preserve Preview's accounts and test data.
3. Apply the repository's ordered schema migrations to the empty production database, never copy Preview data. Review the migrations' closed defaults. Run PostgreSQL/RLS tests, hosted advisors and direct anonymous/member/staff access probes. Provision a reviewed dedicated application database role; do not use the schema owner's password in the web deployment. Confirm account/session deletion can revoke immediately with that role.
4. Supply actual operator/contact details and approve versioned policy text. Confirm retention, moderation and support ownership before accepting public community accounts. Keep unavailable functionality visibly closed; do not claim any unperformed legal review or research validation.
5. Prepare Production-scoped variables in ignored storage and verify their names/targets without printing values. Add no paid provider, polling schedule or outbound campaign. Configure SMTP separately only when its credentials and sender are available.
6. Commit the reviewed implementation. Run typecheck, platform/database tests, lint, build, client-secret canaries, relevant browser/accessibility checks and a source/export secret scan. Export using `node scripts/prepare-hosted-preview.mjs --production`; the production path refuses an unapproved/mismatched manifest and uncommitted deployable source.
7. Deploy the reviewed export to the dedicated project with the Production target and domain assignment skipped. Verify source SHA, target, secrets boundary, mobile/desktop public pages, canonical metadata, disabled-account behaviour and private-route controls. If accounts are enabled, perform genuine verified lifecycle/role/region/deletion acceptance before exposing them.
8. Add only `docked.com.au` and `www.docked.com.au` to that project. Obtain the exact project-specific DNS recommendations and certificate-verification requirements from Vercel. Do not guess a universal CNAME or IP from this document.
9. Change only the apex website A records and `www` CNAME at GoDaddy after the replacement deployment is READY and accepted. Redirect `www` to the canonical apex. Preserve MX, SPF, DKIM, DMARC, nameservers and unrelated records. Check certificate issuance, apex/www HTTPS, retired storefront redirects and errors from independent DNS resolution and browser sessions.
10. Record the actual cutover timestamp, deployment ID, SHA, resource identities, DNS before/after, acceptance results and rollback receipt. A prepared configuration is not a completed launch.

## Rollback

Before switching traffic, save the full website DNS preimage, existing Pages commit and Vercel domain configuration. The baseline website values above are evidence from 4 October, not permission to overwrite a subsequently changed record without comparison.

If the new release fails after cutover, first disable new registration/mutations as necessary, then restore the prior apex A records and `www` CNAME only after verifying that GitHub Pages serves the approved neutral Docked transition page. Never restore the retired storefront against the owner's deletion instruction. Preserve all newly created accounts and records; DNS rollback must not delete production data. Verify the neutral page over HTTPS after propagation. Keep the failed deployment, database and diagnostics for repair. Do not force-push or rebuild `main` from the Next.js application branch.

Subsequent application rollbacks should use a previously accepted Vercel production deployment, with compatible database migrations. Never reverse an immutable ledger migration destructively to make an old app build run.

## Outstanding external inputs

- Cost acknowledgement for the separate $0/month Docked Production Supabase project.
- Paid hosting scope and exact purchase approval/spending controls.
- Verified operating entity/ABN and monitored support contact; approved Terms/Privacy/retention versions.
- GoDaddy DNS access for the actual cutover.
- Transactional SMTP credentials and sender verification before public signup, plus ordinary community regional policy and operational ownership.

The public transition page is live; the new application production launch remains pending. Update the application status only from actual deployment and acceptance evidence, not from the transition page or this runbook.
