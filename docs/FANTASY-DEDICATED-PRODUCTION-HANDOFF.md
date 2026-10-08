# Dedicated production organization checkpoint — 8 October 2026

**Later owner update (same date):** the original **Docked** organization `ernfnkcbalhyqpsrzdwa` now reports **Pro**, while the dedicated **Docked Production** organization `otldyeunbqabbcjydjpe` still reports **Free**. The owner confirmed the former dashboard URL. The US$0 statement below describes the earlier agent-created destination, not the owner's newly upgraded subscription. A second Micro project in the original organization would normally make its baseline about US$35/month, above the approved US$25 cap; exact invoice/compute settings have not been verified. The owner must choose whether to correct billing placement while preserving Preview or approve that higher baseline before provisioning. No additional purchase, downgrade, transfer or project creation occurred. Netlify account creation is owner-reported; authenticated access is not yet confirmed.

**Fantasy production is not live.** The public [Docked URL](https://docked.com.au) still serves the existing holding page (HTTPS 200); `www` returns 301 to the HTTPS apex. DNS and Microsoft 365 MX records were not changed. No Netlify site/deployment ID or deployed production commit exists.

Continued from `2e0a8e24` on `pivot/fantasy-cards-preview-v1`, preserving the earlier implementation, Netlify preparation, Preview and Edge. No reset, database copy, paid upgrade, remote migration or production promotion occurred.

## New approved destination

Created **Docked Production**, organization **`otldyeunbqabbcjydjpe`**, using the authenticated Supabase CLI. A subsequent organization read confirmed the name and **Free** plan. This is the new dedicated destination; reuse it, **do not create another organization**. There is no production project yet. No recurring charge was activated: actual new recurring cost remains **US$0**. The approved ceiling is **US$25/month before applicable taxes**.

Updated the production manifest and runtime/environment/export checks to require this exact new organization. Preview configuration still targets its original organization. The manifest remains `approved: false`, production project and Netlify site/account/staging IDs remain null, and the checked-in Netlify build record remains empty. None of these preparatory changes authorizes a deployment by itself.

Pro activation is externally blocked. The advertised Supabase `get_cost` connector returned `MCP tool get_cost was not returned by tools/list` (`UNAVAILABLE`). Available CLI organization creation does not offer subscription checkout. The supported subscription flow requires the dashboard; browser automation exited before initialization (`trusted Node process exited unexpectedly`). No browser storage/token extraction, undocumented billing mutation, account-security bypass or blind paid purchase was attempted.

Current published [Supabase pricing](https://supabase.com/pricing) supports the requested baseline: Pro US$25/month, one Micro project US$10/month offset by the included US$10 compute credit. This is published pricing, **not a verified checkout quote**. [Spend-cap documentation](https://supabase.com/docs/guides/platform/cost-control) distinguishes capped usage from explicitly selected compute/add-ons. Keep the spend cap on and all extra paid options off. Do not create a second project, branch, replica, IPv4 add-on, custom Supabase domain, PITR, log drain, phone MFA or additional disk IOPS/throughput. Use authenticator-app MFA, not paid phone MFA. The Sydney region is `ap-southeast-2`; actual availability still needs verification when provisioning.

## Preserved resources

- Docked Preview `bckkllmndoxzpzdqrevb` in `ernfnkcbalhyqpsrzdwa`: read-only status check returned **ACTIVE_HEALTHY**. Preview homepage returned 200 and anonymous `/api/fantasy` returned 403. No database data was queried or changed. Authenticated three-user acceptance was not rerun.
- Existing Vercel Preview and Vercel production project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`: no modifications, deployments, deletion or reassignment.
- **Oura was not accessed or modified in this run.** No Oura project query, credential read, pause, migration or other operation was attempted. Account-level organization-name discovery was filtered solely to detect an existing organization named Docked Production before creation; no Oura resource details were requested or displayed. Earlier inspection requests recorded in old reports are superseded by the owner's strict exclusion.
- Edge code/data preserved. This checkpoint does not establish a fresh authenticated end-to-end Edge production test.

## Netlify and production email

Netlify Free remains the approved target. [Commercial-use allowance](https://www.netlify.com/blog/introducing-netlify-free-plan/) and [current pricing](https://www.netlify.com/pricing/) support the choice; its free allowance can pause service when exhausted. No paid Netlify plan or auto-recharge was activated.

There is no available Netlify connector, NETLIFY environment configuration, or configuration file in the four checked standard CLI locations. Browser automation cannot initialize. Therefore the actual account/Free plan, site, OpenNext adapter and function runtime remain unverified. No generic static upload, anonymous hosting workaround or Preview-database substitution was used. Existing `netlify.toml`, source export, exact site/account/commit binding and controlled staging preparation remain available for the authorized connection.

Public signup also needs a verified custom SMTP sender and controlled inbox for actual confirmation/recovery tests. The existing domain's MX points to Microsoft 365, but this does not prove mailbox access or SMTP authorization. Supabase's [default Auth sender](https://supabase.com/docs/guides/auth/auth-smtp) is restricted and is unsuitable for public launch. Do not disable email confirmation to work around it. No new paid email service is authorized.

## Policies and reward configuration

Prepared [Terms, Privacy, community rules and reward conditions](FANTASY-PRODUCTION-POLICY-DRAFT.md) as a review draft. The verified operator remains Ginty United Investments Pty Ltd, ABN 78 606 187 106. Current address, monitored support/privacy route, processor locations and retention/complaint procedures remain unresolved. No unverified address, consent version or legal approval was published. The existing public policy pages still require the approved Fantasy wording and preservation of separate Edge terms before launch.

Existing SQL/game implementation is unchanged: one 11-card Starter per eligible verified member, 10 points per server-UTC daily claim, one controlled CORE reward pack every seven successful claims when stock/daily cap permits. Initial Starter allocation is 1,000 packs; initial reward allocation 10,000 packs, at most 100 card rewards shared per UTC day. Permanent edition caps and immutable receipts remain enforced. Marketplace, sales/trades and all real-money mechanics remain disabled. No production inventory or account has been created yet.

## Verification actually performed

- Focused isolation/provenance/Netlify/release suite: **14 passed, zero failed**. Added rejection of the old Preview organization and unrelated organizations at runtime and source export.
- TypeScript and changed-file ESLint checks: passed. No SQL, UI gameplay or dependencies changed, so prior broad suites/builds were not rerun merely to inflate coverage.
- Public HTTPS, redirects, unchanged DNS/MX, Preview access boundary and APK/private-download hash verified; see [evidence](qa/fantasy-production/dedicated-production-check.json).
- Changed-file secret audit is recorded separately in `qa/fantasy-production/dedicated-production-secret-audit.json`. It is a local-source/evidence check, not certification of a Netlify bundle.
- Historical evidence remains: 8 actual local PostgreSQL 17.10 concurrency/integrity scenarios and 13 focused PGlite tests passed at the preceding integrity checkpoint. They used isolated fixtures, not Supabase production Auth.
- **Not run:** hosted production signup/verification, login/recovery, Starter/daily/seventh-claim transactions, production RLS/MFA, deployed Netlify adapter, cross-device gameplay, social/Edge authenticated acceptance or production domain cutover. No production environment exists yet. No actual Android/iPhone native testing was performed in this checkpoint.
- No new reviewers or Ultra audit were launched; no model/effort switch is claimed.

## Barry's APK

Desktop file: `C:/Users/61412/Desktop/Docked-Preview-S24-v8-Fantasy-Cards.apk`. Version **1.7-preview**, build **8**, **11,044,694 bytes**. SHA-256 **ae888b5cfc393ed2ee9e66b4e1c1566382d70888d9c41585d1d9afdd401b902e**. Desktop and private download matched the expected hash. This remains the Fantasy Preview app, not a production Android release.

The existing file-scoped private download returned 200 and expires **11 October 2026 at 10:36:46 am Sydney**. Its bearer URL is preserved privately and excluded from source/reports. Ready-to-send Desktop `.eml` and `.txt` files remain under `Docked-Barry-Android-Preview`, with the pending-website wording and outside-Google-Play installation instructions.

**Email not sent.** The Google profile connection returned an identity, but the Gmail mailbox operation returned `mail_service_not_enabled`. A profile response is not proof of a functioning Gmail mailbox. No send was attempted after that confirmed service failure, and no sent-message confirmation exists.

## Exact external actions needed

1. Open [the new Docked Production organization's billing page](https://supabase.com/dashboard/org/otldyeunbqabbcjydjpe/billing). Complete the Pro checkout only if the quote is at most US$25/month baseline excluding taxes, spend cap stays enabled and no extra options are selected. Existing authorization covers that amount; no new routine approval is needed. If checkout differs, provide the exact quote before purchase. Restore authorized browser access if the agent is to complete this step. Do not upgrade either existing organization.
2. Connect a functioning Netlify account/CLI session on Free. Reuse any verified existing Docked site, otherwise create one dedicated destination; record the real site/account IDs. Keep the holding page and all current Vercel resources unchanged.
3. Confirm the current business/correspondence address and monitored support/privacy mailbox. Confirm final retention/complaints/processing facts against the draft, then approve actual document versions. Do not substitute the historical VIC 3081 address for the unverified current address.
4. Provide an authorized production SMTP sender and controlled test inbox within existing cost authority. Configure exact staging/live redirects and MFA, verify real Auth delivery, then record evidence. Do not paste privileged credentials into source or chat; use the secure local environment/provider settings.
5. For Barry, connect an actual Gmail-enabled mailbox or send the Desktop message manually before the private link expires. This does not block independent platform preparation.

After external access is available, provision exactly one Sydney Micro project in the **new** organization, inspect its identity/plan/add-ons/quote, apply reviewed migrations, configure least-privilege runtime credentials and MFA, verify actual RLS/ownership/concurrency/Auth, and stage with the exact Netlify URL. Finalize and test policy consent and production gameplay. Only after critical gates pass should DNS move to the verified Netlify destination, retaining the current GitHub Pages records as the rollback snapshot and preserving MX/unrelated records. Record deployment ID and source commit, then repeat public HTTPS/signup/gameplay checks. No remaining authorization permits bypassing these gates.
