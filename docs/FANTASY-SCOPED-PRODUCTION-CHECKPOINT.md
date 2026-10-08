# Organization-only production continuation — 8 October 2026

**Later outcome:** the owner subsequently confirmed all requested billing controls. One production database was created and migrated; see [provisioned production checkpoint](FANTASY-PRODUCTION-PROVISIONED.md). The missing-project/billing blockers below are historical and resolved. Legal/contact, SMTP and hosted acceptance gates remain.

## Owner confirmation follow-up

The owner has now explicitly confirmed **“no project yet”** in Docked Production. This resolves the project-existence question by owner confirmation; it is not a successful live API inventory. A fresh exact-organization read still reports Pro. The cost connector still returns `UNAVAILABLE` because `get_cost` is not exposed by the server. Current published pricing includes one Micro instance within the US$25/month Pro baseline, but this does not establish the organization's actual Spend Cap or add-on settings. Requested confirmation of Spend Cap ON, a US$25 recurring baseline before tax and no paid add-ons. No project was provisioned, and no hosting, DNS, Preview or Oura operations occurred in this follow-up. Contact/policy and SMTP blockers below remain unresolved.

The historical project-existence statements below describe the preceding checkpoint and are superseded by this owner confirmation. Once the remaining billing controls are confirmed, create exactly one `docked-production` project in Sydney with Micro compute; no further account-wide discovery is needed or permitted.

Continued from `18c08c1c` on the existing branch without rebuilding features. Supabase work was restricted to **Docked Production `otldyeunbqabbcjydjpe`**. No account-wide organization/project discovery, Preview operation or Oura access was performed in this run. Netlify work targeted only the existing approved site `2292ba6e-7073-4804-b69a-26b41c9a9fb1`.

## Verified state and limits

- Scoped organization read confirms **Pro**. This establishes the plan, not the actual invoice, Spend Cap, project count or add-on configuration.
- The cost connector still fails with `UNAVAILABLE: MCP tool get_cost was not returned by tools/list`.
- Browser automation still exits before initialization. No authenticated dashboard could be inspected.
- No `SUPABASE_ACCESS_TOKEN` was present in the process, the authorized local `.env.local`, or the standard legacy token file. No OS/browser credential store was extracted and no broad discovery fallback was attempted.
- Production project existence is **unknown**, not confirmed absent. No project was created because duplicate compute and the approved baseline could not yet be ruled out.
- Netlify site read confirms the expected site/account, no custom domain, no published deployment and empty remote build settings. Its local reviewed `netlify.toml` remains intact.
- The holding page returned HTTPS 200. No DNS change or public promotion occurred. No production migrations, secrets, SMTP configuration or test accounts were applied.

## New safe discovery tool

Added `scripts/production-supabase-inventory.mjs`, a read-only management-API checker restricted to the documented endpoint:

`GET https://api.supabase.com/v1/organizations/otldyeunbqabbcjydjpe/projects`

It handles bounded pagination within that endpoint, searches for the exact `docked-production` name, rejects incomplete/changing/duplicate inventory, explicitly excludes protected project refs, and checks an exact matching project's organization and Sydney region before reporting it. It never calls account-wide project discovery. It does not follow redirects or server-provided pagination URLs, and does not create resources, approve a manifest or claim billing verification. Only sanitized errors and selected non-secret project metadata are emitted.

The executable accepts no organization/URL/token arguments. An authorized token is supplied only through the **local process environment** as `SUPABASE_ACCESS_TOKEN`; do not use a browser-public variable, upload the management token to Netlify, paste it into chat or commit it. The documented fine-grained permission for discovery is `organization_projects_read`; the direct project identity check also needs the relevant project-read permission within this organization. A read-only connection is sufficient for this check. No credential store is read by the script.

Run from the Docked checkout after the connection is configured:

```powershell
node scripts/production-supabase-inventory.mjs
```

An actual invocation this run stopped locally because the token was absent. **No successful live project inventory is claimed.** Even a complete empty result retains `billingVerified: false` and `readyToProvision: false`; separate cost-control evidence remains necessary.

[Official organization-project endpoint documentation](https://supabase.com/docs/reference/api/v1-get-all-projects-for-organization) establishes the permitted scoped route. [Supabase cost controls](https://supabase.com/docs/guides/platform/cost-control) explain why Spend Cap alone does not cover deliberately selected compute/add-ons. Keep exactly one Micro production project within the existing Pro allowance and verify the approved US$25 baseline before provisioning.

## Netlify configuration attempt

Attempted to apply HTTPS enforcement, the already-reviewed guarded build command, `.next` output and private build logs to the existing empty site. The initial request returned HTTP 422; an attempt using the installed official API schema encountered a DNS lookup failure. After network recovery, a read-back and final response still showed unchanged settings (`force_ssl: null`, `build_settings: {}`). **No successful remote settings change is claimed.** Do not repeatedly retry or infer these settings are active. The local `netlify.toml` remains the reviewed configuration for the eventual hosted build. No site, deployment, domain or paid option was added.

## Tests actually run

- New scoped discovery tests: **5 passed** after fixing an initial top-level-await compatibility failure in the test runner. Cases include empty inventory without purchase authority, direct identity/region checks, protected refs, incomplete/duplicate pages, a target on a later page, no account-wide fallback and sanitized network/provider failures.
- TypeScript, focused ESLint, Prettier and `git diff --check`: passed.
- Credential-pattern scan of the two new code/test files: **2 files, zero findings, zero errors**. No Preview secrets were loaded for this scan.
- These transport tests use authored responses. They do **not** prove Supabase project discovery, production Auth/RLS, migrations or gameplay work remotely. The earlier 14 release tests and 8 actual local PostgreSQL scenarios remain separate historical evidence.
- No SQL/game-rule/UI/dependency changes; no repeat full security audit or new reviewer was launched.

## Exact remaining owner actions

1. **Project discovery/access:** configure an authorized organization-restricted Supabase API connection in the local environment so the checker can inspect only Docked Production. Alternatively, provide the direct project dashboard URL if one exists, or confirm **“no project yet”** from this organization's dashboard. Do not create another organization or disclose a token in chat.
2. **Billing:** confirm **Spend Cap ON**, the upcoming recurring baseline is at most **US$25 excluding applicable taxes**, and no extra paid add-ons/replicas/branches/compute have been selected. If a project already exists, its exact compute/add-on settings need direct verification. Pro plan membership by itself does not prove these facts.
3. **Contact/policies:** confirm the current business/correspondence address and monitored support/privacy email. The existing Netlify account billing record has no address and does not verify a customer-support mailbox. The authorized historical storefront address remains unverified as current. The company/ABN remain verified, but the policy draft is not approved for publication.
4. **Mail:** identify and connect the existing authorized SMTP/email provider and a controlled inbox for actual confirmation/recovery tests. No SMTP/provider configuration was found in the authorized local environment. No paid sender or disabled-verification workaround is approved.

After access and billing evidence are available, reuse any verified production project or create exactly one Sydney Micro project in this organization, then apply the already-reviewed migrations, configure least privilege/RLS/MFA, production mail and exact callback allowlists. Finish policies and staged browser/API/database acceptance, including concurrent claims and scarcity. Only after all critical gates pass should the holding page be replaced. Nothing in this checkpoint changes the marketplace/payment prohibition or authorizes access to Preview/Oura.
