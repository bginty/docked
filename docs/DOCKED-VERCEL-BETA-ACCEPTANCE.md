# Docked Vercel beta acceptance — 9 October 2026

Status: **not launched; protected review deployment preparation in progress**. Continue `c8dd751f` and `d93e08d6` without resetting the existing branch. This report supersedes the earlier Netlify hosting choice, not earlier security or gameplay gates.

## Resource and feature inventory

- Vercel connection now succeeds for `docked-production`, project `prj_l0rpVDPRuIRp9UcBUkudeyUK5yST`, team `team_tf6xweKKyVCj9bTppUKttJ4l`. Initial readback: Next.js, Node 22, no deployments or domains, Vercel Authentication enabled for non-custom-domain deployments. The owner confirms Pro; this connector's team readback does not expose billing, so the actual subscription is not independently attested. Vercel Pro supports business use; no plan change is authorized or performed.
- Exact GitHub repository `bginty/docked` is connected and writable. It is public. The existing local branch is retained; the planned remote review branch is `codex/vercel-beta-review`. No main-branch push or public domain promotion.
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
- Full platform run: 434 tests, 433 initially passed. One temporary-build fixture omitted the new imported module; repaired it. The complete affected deployment group then passed 15/15. These are local tests, not production acceptance.
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
