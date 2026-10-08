> Current checkpoint: [Hosted email queue verification](DOCKED-HOSTED-EMAIL-QUEUE-VERIFICATION.md). The controlled hosted message received Graph 202 and owner-confirmed Inbox delivery. Existing Microsoft credentials are now protected Supabase secrets; all three sending/worker/test flags are false again. Full Auth acceptance and launch remain blocked. Earlier local-only/no-upload statements below describe historical checkpoints.

# Docked production — Microsoft 365 authorization checkpoint

8 October 2026. Continued from `a9126366` on `pivot/fantasy-cards-preview-v1`, preserving all completed work. **The Fantasy website is not launched.**

## What the administrator needs

Follow [the Microsoft 365 setup guide](DOCKED-MICROSOFT365-SETUP.md). Create the single-tenant Docked app, upload only the prepared public certificate, and grant Exchange Application Mail.Send scoped to `support@docked.com.au`. Verify support is allowed and another owned mailbox is denied. Do not grant tenant-wide Entra Mail.Send or enable basic authentication.

Return the Tenant ID, Client ID, Enterprise application Object ID and scope-test outcomes; no secrets in chat. Confirm Exchange data location and mailbox retention/holds for the privacy disclosure. No existing Entra app or Graph connection is available. Browser automation failed during initialization; no tenant administration or Microsoft permissions were changed by the agent.

The local public certificate is `private-data/production/microsoft365/docked-graph-public.cer`. Its RSA 3072-bit private key remains ignored/private locally, not uploaded to Microsoft, Netlify or Supabase. Certificate/key match and expiry were verified. The owner-confirmed street address is stored only in ignored operator configuration; public policy content uses company, ABN and support email.

## Prepared and verified

- Signed Supabase Auth email adapter using PS256 certificate client assertions and Microsoft Graph. Fixed production project, fixed support sender, exact callback allowlist, bounded body and shared four-second network timeout. Signature verification precedes parsing or sending. Provider errors are redacted; Graph 202 is not treated as proof of delivery.
- Deployment to **only** Supabase project `pojoymtniryarxxunyvz`, organization `otldyeunbqabbcjydjpe`: function `docked-auth-email`, ID `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, version **1**, bundle SHA-256 `c9bd0213a787a7edc8c2ae06f9b8e8e40350eaaea65fdf629ef70aacbe66e8cb`. Gateway JWT verification is disabled specifically for the signed hook; raw-body signature validation is mandatory. A private hook signing secret exists, **mail enabled is false**, Microsoft credentials are absent, and the Auth Send Email hook has not been enabled.
- Five actual hosted HTTP checks pass: GET 405, unsigned 401, tampered signed payload 401, oversized body 413, correctly signed request reaching the disabled sender 503. No accounts or game records were created. [Evidence](qa/fantasy-production/graph-hook-prelaunch.json).
- All 12 real PostgreSQL/Auth/Data API prelaunch checks passed again: runtime least privilege, RLS, denied raw/private/privileged operations, closed signup and mandatory verification. [Evidence](qa/fantasy-production/provisioned-prelaunch-check.json).
- 27 focused local email, Auth readiness, production isolation, Netlify identity, provenance and release-tool tests passed. Two callback tests passed. TypeScript and changed-file ESLint passed. These are not evidence of successful email delivery or hosted gameplay.
- Changed-file credential/address scan found no exposed production secrets or private correspondence address. Dependency audit reported zero vulnerabilities; `git diff --check` passed. No Preview credentials were loaded by the scan.
- One focused read-only **Astra High** review inspected the mail adapter without nested delegation or shared-data changes. Main agent removed unsupported invitation handling, added timeout/partial-delivery tests, preserved PKCE prefixes, and added a truthful intermediate two-address email-change screen. No new Ultra audit or claimed main-agent model switch.
- Expanded owner-review Terms, Privacy Policy, reward/community rules, complaints and retention disclosures. They remain drafts with no approved consent version. [Draft](FANTASY-PRODUCTION-POLICY-DRAFT.md).

## Hosting and cost

| Item | Verified status |
| --- | --- |
| Public URL | `https://docked.com.au` — HTTPS 200, existing holding page |
| www | HTTPS 301 to `https://docked.com.au/` |
| Staging URL | `https://docked-production.netlify.app` — HTTP 404; app not deployed |
| Netlify | Existing Free site `2292ba6e-7073-4804-b69a-26b41c9a9fb1`; no website deployment ID |
| Production database | Existing Sydney Micro project `pojoymtniryarxxunyvz`, dedicated Pro organization `otldyeunbqabbcjydjpe`; all 20 original migrations previously applied |
| Cost | Owner-confirmed US$25/month before tax, Spend Cap ON, no add-ons. No new plan or paid add-on activated. Actual invoice/usage charges were not independently available. |

[Public HTTPS evidence](qa/fantasy-production/mail-checkpoint-hosting.json). DNS and holding-page content were not changed. Netlify's existing production preparation requires approved policies and verified activation facts. Those gates were not disabled or satisfied with invented values to create a deployment. App/function deployment identifiers are separate: the disabled Supabase hook deployment is not a website launch.

## Exact remaining gates and continuation

1. **Microsoft administrator:** finish the scoped app/certificate authorization described above. Then configure production Graph secrets, activate the signed hook under controlled access, and prove received signup/recovery email plus PKCE callback/session completion. Test both secure email-change confirmations. Actual mailbox delivery is unverified.
2. **Owner/legal review:** approve actual Terms/Privacy/community/reward versions and the initial territory/state scope. Production has zero region-policy rows; a proposed Australia-only launch is not approval. Assign complaint/privacy/moderation responsibility, resolve relevant Privacy Act/eSafety applicability and approve accurate provider/retention disclosures. Do not publish the private street address without an established legal requirement.
3. **Privacy operations:** immutable Fantasy history currently retains account UUIDs. Document lawful necessity/minimization and test account deletion plus maintenance execution. Current self-service export is not a complete historical Fantasy export; verify the support-assisted access procedure or implement a scoped export before promising complete access. No invented retention claims or silent policy approval.
4. **Staging and administrator:** after prerequisites, initialize production with real approved policy versions, configure its territory policy, enroll the authorized administrator with TOTP, prepare the existing Netlify site's production-only secrets and controlled staging access, then deploy the committed application. Verify runtime provider identity and source provenance.
5. **Actual acceptance:** hosted signup/verification/recovery, starter allocation and duplicate prevention, daily/seventh claims, real concurrent transactions, ownership/scarcity/isolation, moderation/Edge, export/deletion, desktop/mobile browsers. Do not substitute fabricated accounts or mocked tests for these gates. Native Android/iPhone testing remains unverified.
6. **Promotion:** only after all critical checks pass, preserve rollback evidence, route apex/www to the verified Netlify deployment, preserve Microsoft mail DNS, and rerun public HTTPS/Auth/reward smoke tests. Payments and marketplace remain disabled.

Preview, Oura and existing Vercel resources were not accessed or modified in this work. Their preservation is not a fresh claim of live acceptance. Barry's prepared APK/email remain unchanged; no email delivery confirmation exists.
