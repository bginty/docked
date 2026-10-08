# Connected hosting checkpoint — 8 October 2026

Later continuation: [organization-only production checkpoint](FANTASY-SCOPED-PRODUCTION-CHECKPOINT.md) records the scoped discovery tool, exact remaining access/billing facts and latest verification. No production deployment has occurred.

Continues the same `pivot/fantasy-cards-preview-v1` branch from `229cc791`, preserving application and database implementation. This update supersedes the disconnected-account and billing-placement blockers in prior reports.

## Verified resources

| Resource | Current result |
| --- | --- |
| Docked Production Supabase organization | `otldyeunbqabbcjydjpe`, **Pro** |
| Original Docked Supabase organization | `ernfnkcbalhyqpsrzdwa`, **Free** |
| Production database project | Not yet identified/provisioned by this agent |
| Netlify team | Docked, slug `bginty`, ID `6ac753a0bfe95a1bc4d156b9` |
| Netlify plan | **Free**, 300 included credits, `accumulate_overages: false`, builds blocked when usage exceeded |
| New Netlify site | `docked-production`, ID `2292ba6e-7073-4804-b69a-26b41c9a9fb1` |
| Site staging origin | `https://docked-production.netlify.app` |
| Published deployment / deployed commit | None |
| Custom domain / aliases | None / empty |
| Production source configuration | Netlify IDs/staging URL set; `approved: false`; database ref remains null |

The owner completed the Supabase plan changes. No billing mutation was performed by the agent. The current placement supports the intended published US$25/month Pro baseline with one Micro instance offset by the included compute credit, excluding taxes and optional extras. Actual checkout invoice, prior proration/credits, Spend Cap and project/add-on settings are not verified. Do not claim a refund or zero historical charges. Do not activate a second project/subscription or optional paid service.

Netlify CLI 27.11.2 was authenticated through its official user-approved ticket flow. Credentials remain in the CLI's local configuration, never source. The site was created only after verifying the Free team had no sites, then independently read back to confirm its account ID and lack of deployment/domain assignment. No Git auto-build link, application deployment, environment secrets, custom domain, DNS changes or paid options were configured. Reuse this site; do not create another.

## Remaining scoped database blocker

The advertised Supabase `get_cost` connector still fails with `UNAVAILABLE: MCP tool get_cost was not returned by tools/list`. Browser automation fails during initialization. CLI project listing is account-wide, not organization-scoped.

Automatic approval review rejected the proposed account-wide inventory command because fetching all projects would retrieve Oura metadata before filtering. **The command did not execute**, and no workaround to enumerate Oura was attempted. Oura data, credentials and project resources were not accessed or modified in this checkpoint. No Oura approval is being requested.

The pending owner question asks for the **direct project dashboard URL in Docked Production**, or confirmation **“no project yet”**, plus **Spend Cap enabled / no paid add-ons selected**. This resolves unknown project existence and prevents accidental duplicate compute without broad inventory. If an existing project is supplied, use its exact ID for direct verification of organization, region, health, compute/add-ons and clean production suitability. If no project exists and cost controls are confirmed, use the already authorized one-Micro Sydney creation path; retain generated database credentials only in ignored private storage. Independently verify the actual project before migrations. Do not fill the manifest with an invented ref or use Preview credentials.

## Preserved gates and next work

All earlier security and release gates remain. No database migration or configuration change was applied to Preview; no Vercel resource was modified. The holding page has not been replaced. The empty Netlify staging URL is not a working Fantasy website and must not be described as delivered.

After the isolated project is verified, configure reviewed migrations, least-privilege roles, RLS, email verification/recovery, MFA and exact callback URLs. Resolve the current business/correspondence address, monitored support/privacy contact, processor/retention facts and approved policy versions from the existing policy draft. Public registration and game activation remain closed until actual evidence satisfies these checks. Marketplace and monetary features stay disabled.

Only then prepare production-scoped Netlify secrets and perform an actual hosted build/staging acceptance with the immutable provider identity checks. Do not manually forge `NETLIFY`, `SITE_ID`, `ACCOUNT_ID`, `COMMIT_REF` or deployment metadata to force a local artifact past the guard. Keep the public holding page through actual Auth/gameplay/RLS/concurrency/mobile-desktop testing. Move DNS only after critical gates pass and record rollback records first, preserving Microsoft 365 MX and unrelated services.

The Netlify identity update changes configuration only, not SQL, reward rules or UI. Focused release/identity/provenance regressions passed **14/14**, with no failures; `git diff --check` passed. Fresh HTTPS checks returned 200 for the holding page and Preview. Earlier local PostgreSQL scenarios remain historical evidence, not proof of hosted production. Barry's APK/message remain prepared; this checkpoint did not attempt a Gmail send or claim delivery.
