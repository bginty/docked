> Permanent fantasy product direction — 10 October 2026: [PRODUCT_DIRECTION](PRODUCT_DIRECTION.md) overrides earlier product descriptions in this document. Preserve security, approved policy bytes and hosting boundaries; older QA is historical evidence only.

# Netlify preparation and Supabase capacity — 8 October 2026

Continued from `d5d82965` on `pivot/fantasy-cards-preview-v1`. The owner selected Netlify Free as the preferred commercial host, subject to eligibility and compatibility. The existing Vercel project remains intact and unused for production; the Vercel Preview remains unchanged. No cloud resources, billing, database contents or DNS were changed.

## The two occupied Free database slots

| Name | Project ID | Organization | Purpose | Current status |
| --- | --- | --- | --- | --- |
| Docked Preview | `bckkllmndoxzpzdqrevb` | Docked, `ernfnkcbalhyqpsrzdwa` | Existing isolated Docked Preview and Fantasy tester/Edge data; preserve completely | `ACTIVE_HEALTHY`, Sydney `ap-southeast-2`, PostgreSQL 17.11.0.002 |
| Oura CRM UAT | `dwdjeecjdkkiidoutnme` | Separate organization `eadbdqbkrqucdhialgoz` | Oura CRM user-acceptance environment; never reuse for Docked | `ACTIVE_HEALTHY`, Singapore `ap-southeast-1`, PostgreSQL 17.6.1.166 |

Docked's organization is Free and contains the first project. The second project is **not** inside Docked's organization. Both count against the owner's cross-organization two-active-Free-project limit. The preceding creation attempt explicitly received this quota refusal; it was not repeated. [Supabase billing rules](https://supabase.com/docs/guides/platform/billing-on-supabase).

Project names, organizations, engine versions and health were rechecked through Supabase's project metadata API. No Docked Preview data query, migration or mutation was performed. Oura has no listed Supabase Edge Functions; this does not establish whether its database/Auth or externally hosted application is used.

An aggregate-only Oura query was requested to inspect estimated table counts and cumulative activity, without retrieving records. **Automatic approval review rejected it**, interpreting the owner's prohibition on using Oura infrastructure as excluding this separate project's database metadata. No SQL results were returned and no alternative database route was attempted. Permission for a narrow aggregate read was requested; no answer was received before this checkpoint. Valuable data and recent business use therefore remain **unverified**. `ACTIVE_HEALTHY` means the service is running, not that it is unused or that customers are active.

**Recommendation: preserve both. Do not retire Oura on current evidence.** If the owner later authorizes inspection and confirms it is unused, assess backups/dependencies and recommend reversible pausing before deletion; that action still requires explicit approval. No retirement, overwrite, project transfer, shared schema or Oura credential reuse is authorized or performed.

## Cheapest safe launch options if both are needed

| Option | Indicative hosting + database baseline | Conditions |
| --- | --- | --- |
| Netlify Free + one Micro production project in a new, dedicated Supabase Pro organization | **US$25/month** | Lowest standard Supabase option found that preserves both existing Free projects. Requires explicit paid approval and approval of a new production organization; update the reviewed organization binding after its real ID is known. No duplicate production project currently exists. |
| Netlify Free + upgrade existing Docked organization with Preview and production as two Micro projects | **US$35/month** | Keeps the specified organization. All its projects share the paid plan; estimate is $25 subscription + $20 compute − $10 compute credit. Requires explicit paid approval. |
| Netlify Free + fresh Supabase Free production project after an existing slot is legitimately freed | **US$0/month within quotas** | Conditional only. No project is proven disposable. Never pause Preview or retire Oura without approval. |

Prices exclude taxes, overages, extra seats/add-ons and any email-provider cost. Confirm the actual dashboard quote and spending controls before activation. Free and paid projects cannot be mixed within the same Supabase organization; using a separate **paid** production organization is a supported billing arrangement, not a way to evade the Free quota. [Supabase pricing](https://supabase.com/pricing), [organization billing](https://supabase.com/docs/guides/platform/billing-on-supabase).

Do not replace Supabase with another database merely to chase a free tier: Docked also depends on Supabase Auth, live-session checks and RLS. That would require a separate architecture change and substantial retesting. Oura infrastructure is excluded from every launch option.

## Netlify eligibility, limits and compatibility

Netlify explicitly permits commercial projects on Free. Current credit-based Free pricing is $0 with a **300-credit monthly hard limit and no auto-recharge**. The provider's older commercial-use announcement is used only for eligibility; current quotas come from current pricing docs. [Commercial eligibility](https://www.netlify.com/blog/introducing-netlify-free-plan/), [current pricing](https://www.netlify.com/pricing/), [Free limits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

Current rates include 15 credits per production deploy, 10 credits per GB-hour of function compute, 20 credits per GB of bandwidth and 2 credits per 10,000 web requests. These share one allowance. Free is reasonable to evaluate for a small launch, but there is no traffic/load evidence proving capacity. Sites can pause at the allowance limit. No paid feature, credit purchase or auto-recharge was enabled. Confirm the connected account's actual plan, including any legacy-plan distinction, before creating a site.

Docked uses Next.js 16.3.8, App Router, Node route handlers, SSR, redirects, security headers, static assets and a session-refresh proxy. Netlify documents support through its maintained OpenNext adapter. Its middleware filesystem/native-addon restriction does not affect Docked's inspected proxy, which imports neither filesystem APIs nor native image code. Middleware/header execution order differs, so deployed cookies/cache/security headers must be tested. The Supabase CA certificate and image assets are explicitly traced; their presence in the actual Netlify function bundle still needs verification. Database TLS and Sydney latency also need hosted testing. [Next.js support and limitations](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

**Compatibility established so far:** documented feature coverage, successful local Next.js compilation and automated provider-boundary tests. **Not established:** actual OpenNext adapter packaging, function execution, hosted Auth/TLS, browser gameplay, performance or domain cutover. No Netlify deployment ID/site ID exists.

## Changes prepared locally

- Added `netlify.toml` with Node 22, `.next` output and the existing guarded build command. Netlify's maintained OpenNext adapter is auto-detected. Credentials do not belong in TOML; build-only TOML values are not function secrets.
- Set `hostingProvider: netlify` in the production manifest, keeping approval false and site/account/staging/database identities null. Retained the previous Vercel IDs and the working Preview configuration.
- Added provider-specific site/account/commit checks while retaining common database, legal, disabled-feature and Preview/Oura exclusion checks. Netlify builds require fresh production-context platform metadata. A test caught and fixed reuse of a stale build record when new build metadata was missing.
- The successful build guard writes **only non-secret** site/account/context/commit/deploy metadata to `config/netlify-build.json` before compilation. Its checked-in version is empty and cannot authorize a runtime. At runtime the bundle record must match Netlify's read-only `SITE_ID`; any available build metadata must also agree. No fake Vercel metadata is used. [Build metadata](https://docs.netlify.com/build/configure-builds/environment-variables/), [limited function metadata](https://docs.netlify.com/build/functions/environment-variables/).
- Added controlled staging support using a reviewed exact `https://<site>.netlify.app` origin matching Netlify's read-only `URL`. Wildcards, arbitrary origins and accidental live/staging mixing are rejected. This enables pre-cutover Auth/gameplay verification without replacing the holding page.
- Environment preparation supports `--free-play --staging`, requiring verified staging access plus the existing email/policy/RLS/concurrency checks. Only staging may precede successful live-promotion smoke evidence; live preparation still requires it. Staging mode explicitly resets to `live` during subsequent live preparation.
- Prepared Netlify-specific local environment output under ignored `private-data/production-deploy/netlify-environment.json`. It is a neutral key/value document, **not** an uploaded API payload. Credentials remain absent while production resources/policies are unapproved. Export tooling includes required Netlify files and still rejects dirty/unapproved production sources.
- Added `.netlify/` to ignore local CLI state. No application features, SQL rules, scarcity caps, reward values, marketplace permissions or production dependencies were changed.

The platform's default variables must come from Netlify, not manually entered values. Only the guarded build can generate the bundle record; do not deploy an arbitrary prebuilt directory. Runtime metadata binding supplements, and never replaces, inspection of the actual deployed site/account/commit.

## Verification

- Full platform regression run: **377 passed** before the final staging test additions.
- Final focused provider/provenance/release run: **14 passed**, including staging origin checks and refusal of live promotion without its evidence. The release-tool suite was rerun after making stage-to-live reset explicit.
- TypeScript, ESLint, client boundary and optimized local Next.js build: passed.
- Source/client/evidence credential audit: **438 files**, zero findings/errors. **96 server trace manifests**, zero private-data/.git/attachments/.env.local references. See `qa/fantasy-production/netlify-preparation-secret-audit.json`.
- Real PostgreSQL 17.10's eight integrity/concurrency scenarios remain the preceding checkpoint's evidence; SQL was unchanged, and these were not rerun for hosting-only changes.
- Public holding page 200, www 301 to apex, existing Preview homepage 200; no DNS/domain replacement. See `qa/fantasy-production/netlify-capacity-check.json`.

## Connection blockers and continuation

No Netlify connector or CLI credential/config was found in the checked environment/standard locations. Browser automation was attempted and failed before initialization: `node_repl kernel exited unexpectedly`, with Windows sandbox `setup refresh had errors`. No browser account was accessed or security workaround attempted.

To proceed, connect an authorized Netlify account and verify its Free plan. Inspect existing sites before creating a dedicated Docked production destination; record its real site/account IDs and exact staging URL. Keep the site private/restricted for controlled tests, disable automatic public promotion, and leave `docked.com.au` on the holding page. Use production-only environment context; do not pass production secrets to pull-request/branch builds.

Separately resolve legitimate Supabase capacity or approve the selected paid option. The manifest currently still requires the existing Docked organization. Choosing the cheaper dedicated Pro organization requires an explicit change of target and fresh identity review; no such change has been made.

The verified entity/ABN remains recorded. Current address/support confirmation, finalized Fantasy policy versions and a verified production SMTP sender/inbox remain prerequisites from the preceding handoff. Once resources exist, verify real RLS/MFA, email confirmation/recovery, staging browser and gameplay flows, TLS/cookies/CSRF/cache behavior and preservation of Edge before allowing public promotion. No routine new permission is needed for already authorized preparation/testing; paid services and Oura retirement remain approval-bound.
