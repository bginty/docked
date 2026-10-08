# Docked morning handover — 9 October 2026

**Launch remains blocked. Safe email, integrity, NFL preparation and local regression work is complete; the public holding page is preserved.** Work continues on `pivot/fantasy-cards-preview-v1`. The email checkpoint is committed at `3af7acc8`. No repository reset, infrastructure rebuild or production website promotion occurred.

## Email: controlled hosted delivery passed

Eight concurrent signed enqueues produced one job; two workers produced one Microsoft Graph 202 and one idle result, with one dispatch attempt. The owner confirmed **Docked hosted email queue check ded93c7bd111 arrived in Inbox** at support@docked.com.au. No additional diagnostic email is needed.

The old four-second deadline combined certificate authorization and sending. Missing historical response telemetry prevents proving exactly when Graph accepted that older message relative to the deadline. The new hook removes Graph from the synchronous Auth response path. Queue writes have a three-second budget; the signed worker separately allows ten seconds for certificate authorization and twenty seconds for Graph. Ambiguous post-dispatch failures are held for investigation rather than automatically resent. This provides conservative at-most-one submission per job, not guaranteed exactly-once email delivery.

Existing certificate/key matching and certificate application authentication passed. The exact Entra service principal returned no effective Graph application-role assignments. Administrator evidence confirms the support-only Exchange scope and positive mailbox authorization. The other-real-mailbox negative test remains **NOT RUN** because no second authorized mailbox exists. No Microsoft permissions, certificates or long-lived secrets were created or rotated.

**All three hosted email/test/worker flags are false again. Public signup and the Auth Send Email hook remain disabled.** Real invitation, confirmation, recovery, genuinely expired/reused links and Auth-state reconciliation have not passed end to end. Fabricated invalid-token rejection and a delivered diagnostic are not substitutes. See the [complete email report](DOCKED-HOSTED-EMAIL-QUEUE-VERIFICATION.md).

## Independent work completed

- Fixed a Fantasy transaction response bug. Lost commit acknowledgements and response failures now return an unconfirmed outcome instead of asserting that no changes were saved. The browser retains the original retry ID, even when a later retry is rejected. Only a successful result resolves prior uncertainty. A first-attempt authoritative rejection can still release the request. This is an in-memory mechanism, not persistence across reloads.
- Added unit and interactive browser regression scenarios for uncertain-then-rejected retries and first-attempt rejection. The browser API responses are authored fixtures, not production transactions.
- Prepared inactive NFL offensive-stat scoring and configurable lineup matching: explicit versioned rules, integer points, per-stat audit breakdown and no rarity multiplier. Nothing enables NFL gameplay, creates NFL cards or accesses a provider. The exact queued specification was unavailable; test weights are not approved game rules. See [NFL preparation](FANTASY-NFL-PREPARATION.md).
- Built a source-only local export without environment files or cloud credentials. Re-ran existing Edge, account, social and responsive browser regressions alongside the new Fantasy checks.
- Reverified the existing Android APK instead of rebuilding an unchanged shell. Signature and archive checks passed. No device or emulator was attached; browser tests are not native Android or iPhone verification.

One existing reviewer was explicitly reused at **Astra High**, read-only, without nested delegation or shared/cloud data writes. Its retry-uncertainty finding was investigated, fixed and regression-tested by the main agent. No new Ultra audit or main-agent model switch is claimed.

## Verification

| Check | Result | Scope |
| --- | --- | --- |
| Platform suite | PASS — 408 tests | Includes six NFL and three retry-response tests |
| Database suite | PASS — 205 tests | Local PGlite, not cloud production |
| Fantasy concurrency | PASS — 8 scenarios | Actual disposable PostgreSQL 17.10; starter, daily/seventh rewards, final allocation, ownership, permissions, MFA and session expiry |
| Email queue concurrency | PASS — 6 scenarios | Actual disposable PostgreSQL, recorded in the email checkpoint |
| Browser suite | PASS — 91 tests | Local Chromium, authored fixtures and isolated Edge demo; not hosted production acceptance |
| Fantasy layouts | PASS — 4 checks | Static components at 390/1440 pixels, cards and disabled marketplace |
| TypeScript / full ESLint | PASS | Current implementation |
| Optimized Next build | PASS | Isolated source export, no deployment |
| Build security | PASS | 54 client assets, no actual production secret matches; 97 server traces, no private-file references |
| Dependency audit | PASS — zero vulnerabilities | Email checkpoint; dependencies unchanged overnight |
| Production email | PASS — diagnostic only | Actual signed hosted queue, Graph acceptance and owner-confirmed Inbox receipt |
| Full hosted Auth/gameplay | BLOCKED / NOT RUN | Protected staging and controlled Auth activation prerequisites remain |
| Native Android / iPhone | NOT RUN | No attached device; existing APK inspected locally |

The first isolated build attempt omitted required Supabase source files; the first browser collection omitted an existing brand fixture manifest. Both export issues were corrected before the completed runs. These were local harness setup failures, not hidden production passes. Logs and bulk screenshots are retained under ignored `private-data/production/`; selected non-secret evidence is version-controlled under [overnight QA](qa/overnight-beta/).

## Website, resources and costs

- [docked.com.au](https://docked.com.au): last verified HTTPS 200 **existing holding page**, with www redirecting to apex. This is not the launched Fantasy application.
- [Netlify staging](https://docked-production.netlify.app): last verified HTTP 404. No application deployment ID exists for this work. Existing Free site `2292ba6e-7073-4804-b69a-26b41c9a9fb1` remains reserved.
- Supabase organization `otldyeunbqabbcjydjpe`; dedicated project `pojoymtniryarxxunyvz`, Sydney Micro. Existing 20 game migrations remain; the reviewed additive production-only email migration was applied in the email checkpoint.
- Email function `ef679810-f5e1-4e7e-8dc5-7524e22263b4`, version 4, deployed disabled. This is an email-function deployment, not a website deployment.
- Owner-confirmed Supabase baseline remains **US$25/month before tax**, Spend Cap ON, no add-ons. Netlify remains Free. No paid service or plan was activated. Actual invoice and usage totals were not independently audited.
- Oura was not accessed or modified. Docked Preview and Vercel were not accessed or modified in this work; live availability was not retested. No DNS, email-record or holding-page changes. No real-money or marketplace activation.

## Android and Barry

Desktop file: `C:\Users\61412\Desktop\Docked-Preview-S24-v8-Fantasy-Cards.apk`.

- Version `1.7-preview`, build 8; package `au.com.docked.app.preview`.
- Size 11,044,694 bytes.
- SHA-256 `ae888b5cfc393ed2ee9e66b4e1c1566382d70888d9c41585d1d9afdd401b902e`.
- Existing Preview origin, HTTPS restrictions and disabled WebView inspection verified. It remains a Preview APK, not a new production build.
- Barry email **NOT SENT**. No functioning authorized Gmail connection was available, and the current Microsoft controlled-send authorization is restricted to support@docked.com.au. Existing ready-to-send material and private download reference were preserved; the link's current availability was not retested.

## Exact remaining actions

1. **Owner: authorize a controlled hosted Auth test window.** The latest restriction prohibits activating production email or signup without approval. Scope testing to the approved support account and protected staging, with rollback to disabled flags. No new Graph permission is required.
2. **Owner/legal/operations: approve actual policy versions, launch territory and privacy/retention responsibilities, and complete administrator MFA enrollment.** Company, ABN, mailbox and private correspondence address have already been supplied; they do not need resubmission. The street address stays restricted. Readiness flags were not falsified.
3. **Implementation and acceptance after prerequisites:** deploy protected Netlify staging; complete the reviewed invitation confirmation flow (current callback is PKCE-only), signed worker scheduling, cleanup and failure monitoring. Run actual invitation/confirmation/recovery/password change, invalid/reused/genuinely expired links and pre-/post-enqueue failure reconciliation before opening registration.
4. **NFL scope:** recover the exact queued live-beta/NFL requirements and approve lineup/scoring/correction rules and a permitted statistics source. Complete immutable server rules, inventory/eligibility, settlement and shared UI, then PostgreSQL and hosted acceptance. Inactive helpers do not make NFL launch-ready.
5. **Device/delivery access:** provide an authorized Android device/emulator for native acceptance, and restore authorized Gmail delivery or separately authorize the intended Microsoft recipient workflow before sending Barry's APK. Do not broaden mailbox access.

No repeated blocked administrator calls or duplicate diagnostic sends were attempted overnight. Launch stays closed until mandatory Auth, legal, security and hosted gameplay gates pass.
