# Docked Vercel beta acceptance — 9 October 2026

> Updated status: [Protected Preview deployed](DOCKED-VERCEL-PREVIEW-DEPLOYED.md). Branch mapping and CLI access are resolved. Application commit `2c9a9957` is READY in protected Preview; 437 platform tests and 32 hosted UI/denial checks pass. Functional beta acceptance remains gated. Earlier failures and local-only evidence below are historical.

Status: **not launched; protected review creation blocked by automatic approval review**. Continue `c8dd751f` and `d93e08d6` without resetting the existing branch. This report supersedes the earlier Netlify hosting choice, not earlier security or gameplay gates.

## Resource and feature inventory

- Vercel connection now succeeds for `docked-production`, project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, team `team_tf6xweKKyVCj9bTppUKttJ4l`. Initial readback: Next.js, Node 22, no deployments or domains, Vercel Authentication enabled for non-custom-domain deployments. The owner confirms Pro; this connector's team readback does not expose billing, so the actual subscription is not independently attested. Vercel Pro supports business use; no plan change is authorized or performed.
- Exact GitHub repository `bginty/docked` is connected and writable. It is public. The existing local branch is retained; review commit `cffde28f24feef6a8dc05f4393331222c71f08a9` was pushed to `codex/vercel-beta-review`. No main-branch push or public domain promotion.
- Supabase Production `pojoymtniryarxxunyvz`, organization `otldyeunbqabbcjydjpe`, is healthy. The fresh read-only check confirms zero Auth users/sessions/cards, public signup disabled, verification required, email worker disabled and mail RLS/ACL restrictions intact. No Oura access or Preview mutation.
- Fantasy ownership, fixed scarcity, starter/daily/seventh-claim rules, permanent receipts, concurrency locks, beta result separation, consent/privacy-scoped standings and social permissions are implemented with prior database regression evidence. No claim is made that hosted production gameplay has passed.
- NFL community integration includes the 32-team directory, filters, member content and fixture validation. Live fixtures/odds/results require approved reliable provider data and remain disabled; official NFL predictions, automated settlement and NFL fantasy supply remain disabled. Existing football/Edge implementation is preserved.
- Microsoft Graph certificate sending and the durable queue were previously verified with one accepted dispatch and owner-confirmed Inbox receipt. Fresh readback still shows exactly one attempt and erased encrypted message payload. No repeat email was sent. Actual hosted invitation, confirmation, recovery, expired/invalid links, logout and administrator MFA remain unverified. The other-mailbox negative authorization test remains uncompleted.
- Android beta build preparation exists for package `au.com.docked.app.beta`, version `1.8-beta`, build 9. Packaging remains gated by actual hosted acceptance; no new working beta APK is claimed.

## Safe review boundary

The review build uses the existing application with an explicit review banner. It can only run as a Vercel Preview deployment in the exact project and review branch, with a complete commit identity and Vercel deployment hostname. Database, Supabase, Microsoft, SMTP and provider credentials are rejected. All service/monetary/publication flags are explicitly disabled. Account creation, email and gameplay are unavailable. No demo data is enabled.

This is not a replacement production approval path. `config/hosted-production.json` remains `approved: false`. The production guard, prior Docked Preview binding, Netlify implementation, public holding page and domain records are preserved.

## Verification so far

- TypeScript and changed-source ESLint pass.
- Isolated optimized Next.js build passes without cloud credentials or env files; authored Vercel identities are used only for this local test.
- Final full platform run: **436/436 pass** after the guard, Android provenance and review-login changes. The first run found one temporary-build fixture missing the new imported module; that fixture was repaired. The final affected Android/guard group also passes 14/14. These are local tests, not production acceptance.
- Fresh production read-only mail/security/Auth checks pass; HTTPS apex returns 200 and www redirects 301 to the apex holding page.
- No hosted gameplay, administrator login, invitation or Android native success is claimed.
- Build security: 54 browser assets and 101 server traces checked; zero actual production-secret matches or private trace dependencies. Whole working-tree scan covered 6,138 files (1.38 GB), with zero actual production-secret/private-address matches. Generic pattern findings are retained in the private report: authored credentials/canaries in tests, local PostgreSQL harness and historical QA documentation. The binary Gradle wrapper was not text-scanned; its SHA-256 matches Gradle's official 8.14.3 wrapper checksum (`7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172`). This is not a claim of a perfect historical secret audit.

## Mandatory launch blockers and exact next actions

1. Owner/policy review: review `FANTASY-PRODUCTION-POLICY-DRAFT.md`, approve or amend the beta Terms, Privacy, rewards/community/complaints conditions, approve the 18+ territory/state eligibility scope, and assign support/privacy/moderation responsibility. Resolve processor locations, retention and the documented historical export limitations; do not treat a version string as legal approval.
2. Administrator: nominate the exact owner login email and complete MFA enrollment when the controlled production account is invited. No shared/admin password is provided or inferred.
3. Hosted acceptance: after the required policy/runtime configuration is approved, deploy protected production-connected staging, configure exact callback URLs and the reviewed support-only email test window, and verify invitation/confirmation/recovery/MFA plus real database gameplay. Keep public signup closed. Record Inbox delivery separately from Graph acceptance.
4. Populate only approved, finite production inventory and effective region/reward policies after the applicable gates. Production currently has no playable cards; do not substitute Preview records or simulated test ownership.
5. Promote the verified commit and configure domains only after those checks pass; then generate the Android beta acceptance receipt and build/test the APK. Preserve the holding page until then.

No additional paid services, Microsoft grants, certificates, production approval flags or unrelated infrastructure were changed. No model switch or new Ultra audit is claimed.

## Actual deployment attempts and remaining hosting action

The first Git push unexpectedly produced a **production-target** automatic build. It was immediately cancelled before completion: `dpl_Fs32KgbJcaecDJyj53cy4exGDrtL`, state **CANCELED**, commit `cffde28f`. Subsequent project readback is still `live: false`, with no custom domains and Vercel Authentication enabled. Its generated URL is not a working application and must not be given as a successful delivery.

After the branch existed, 26 non-secret settings were created only for the **Preview** environment and that exact Git branch. There are no database/email/provider credentials in those settings, and no production environment variables were created.

Vercel rejected literal API `target: "preview"` as an invalid enum. Its [current REST documentation](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) documents an omitted target as Preview and `staging` as an alias-producing target. Automatic approval review nevertheless rejected the omitted-target request for potential production promotion, then rejected `staging` because that environment was not verified/configured for the protected review. Neither rejected request created a deployment. No further alternative deployment path was attempted after those rejections.

**Required hosting unblock:** inspect the exact project's production-branch/environment mapping and authorize a verifiably Preview-only deployment of `codex/vercel-beta-review`, with Vercel Authentication retained and no domains assigned. Do not select Production. The build must expose Vercel's system project/commit/branch/environment variables; the committed guard deliberately rejects missing identities. Reconfirm the result's non-production target before testing.

Even once this credential-free review is hosted, it does not unlock accounts. Production-connected Vercel staging still needs a verified exact origin and callback binding; current production staging/Auth-origin rules retain their prior Netlify-only staging allowance. Adapt that binding against the actual protected Vercel destination before any production credential upload, retaining the approved-manifest prerequisite. Do not copy the Netlify origin or use a wildcard callback.

## Additional compatibility repair

Found and repaired a separate Netlify assumption in `/api/beta-release` and Android receipt validation. Vercel now derives public provenance from its real system project, commit and deployment identifiers, and Android requires the exact production project/team and a matching live probe. Legacy Netlify provenance remains supported without allowing mixed identities. Acceptance flags, freshness, closed signup and safety gates remain mandatory. No acceptance receipt or new APK was fabricated. Vercel system metadata reference: [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).

The actual local browser check found that the app login surface hid the outer review banner and still offered an active login form. Added a review notice inside that surface and disabled its submission controls for review-only mode. Existing authorized Preview behavior remains unchanged. Local browser results are recorded separately below; they cannot certify hosted Auth or gameplay.

## Final local acceptance

- **PASS:** optimized build, TypeScript, changed-source lint, 436 platform tests, and dependency audit (zero reported vulnerabilities across 315 dependencies).
- **PASS:** 12 real local page/viewport checks at 320/412/1366: home, app/login redirect, web login and app signup. No request stubs, no horizontal overflow and no uncaught browser errors. Review messaging and disabled app-login submission were verified. The test harness initially used a nonexistent `/signup` route; corrected it to the actual `/app/signup` route rather than changing application routing.
- **PASS:** `/api/beta-release` returns 404 in review mode. Actual local `/api/status` reports database/feed/strategy/publication false and providers unconfigured. It cannot be presented as a playable beta.
- **PASS:** final 54 client assets and 101 server traces have zero detected actual production-secret matches/private dependencies. No new dependency or service was installed.
- **BLOCKED:** hosted invitation, verification, recovery, MFA, RLS/gameplay, cross-device persistence and actual native-device acceptance. Prior database and queue evidence remains valid at its original scope; it is not renamed production gameplay acceptance.

Evidence: [local browser checks](qa/vercel-review/local-browser.json), [exact hosting readback](qa/vercel-review/hosting-readback.json), [local mobile login](qa/vercel-review/LOCAL-app-412.png), [local desktop homepage](qa/vercel-review/LOCAL-home-1366.png). Screenshots are local review UI, not a hosted production application.

The final Android provenance and review-login fixes are committed locally after `cffde28f`. They are deliberately not pushed again while this branch's automatic deployment target is unresolved; avoid creating another production-target Git build. Resolve the exact branch mapping before syncing that final commit and creating the protected Preview.
