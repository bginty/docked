# Guarded Docked hosted acceptance

This suite exercises the real application on `http://localhost:3000` against **only** Docked Preview `bckkllmndoxzpzdqrevb` in organisation `ernfnkcbalhyqpsrzdwa`. It is separate from the existing public/DEMO browser suite. It does not intercept routes, manufacture Auth rows, mint tokens, weaken rate limits, send messages or create sporting performance records.

## Prerequisites controlled by the provisioning operator

Do not start signup or recovery until the operator verifies the capture-only Postgres Send Email hook and explicitly authorises the run. Every exact test recipient must be preapproved by the hook. The operator must export captured messages during signup/recovery into the ignored mailbox file; the browser suite never reads hosted credentials or queries the database directly.

Create `private-data/hosted-preview/acceptance.json` locally. Never commit it. Required properties are documented by `Fixture` in `guard.ts`: exact project/organisation/origins, safe run ID, fresh mail-hook proof (less than 24 hours old), separate community/privileged/deletion permissions, and seven account records. Each account has its exact `docked-preview-…@example.invalid` address, unique strong password and replacement password, handle, AU country and NSW state (WA for the restricted account). No real personal addresses may be used. An optional memberA unsubscribe token must be obtained through the normal notification preparation path without delivery; absence is reported as a separate **BLOCKED** case, never a passing unsubscribe check.

Account labels are `memberA`, `memberB`, `restricted`, `analyst`, `editor`, `admin`, `auditor`. The proposed address aliases are `member-a`, `member-b`, `restricted`, `analyst`, `editor`, `admin`, `auditor`, followed by `-20261003@example.invalid` after the `docked-preview-` prefix.

The suite writes actual verified account UUIDs to ignored `state.json`. The operator can then assign the requested private staff roles to these genuine users and establish an isolated, expiring preview-only community policy. No live publication, licensed odds, settlement, billing, prizes, external notifications or production policy is enabled by these tests. Do not claim verified-price, official-tip saving or real settlement acceptance while the provider remains unconfigured.

Mailbox envelope: `{projectRef,messages:[{email,type,receivedAt,tokenHash,redirectTo}]}`. Only fresh signup/recovery messages for the current account are accepted. Confirmation follows the real project GoTrue verification link in the original PKCE context. The suite does not print or publish that URL.

## Commands

Safe discovery, without account actions:

```powershell
npx playwright test -c tests/hosted/playwright.config.ts --list
```

After the operator's explicit readiness signal, run stages sequentially:

```powershell
$env:DOCKED_HOSTED_ACCEPTANCE='bckkllmndoxzpzdqrevb'
npx playwright test -c tests/hosted/playwright.config.ts --project=signup
npx playwright test -c tests/hosted/playwright.config.ts --project=lifecycle
# Operator assigns roles and confirms the expiring community scope, then updates capabilities.
npx playwright test -c tests/hosted/playwright.config.ts --project=community
npx playwright test -c tests/hosted/playwright.config.ts --project=privileged
# Operator revokes the actual QA policy and writes policy-revocation.json proof first.
npx playwright test -c tests/hosted/playwright.config.ts --project=revocation
# Export before erasing memberA; deletion is deliberately the final stage.
npx playwright test -c tests/hosted/playwright.config.ts --project=deletion
```

Do not rerun signup with already-created accounts. Use a newly reviewed roster for a fresh complete run. Existing genuinely created accounts can be used for later stages. There are no automatic retries and the first failure stops a stage. Each stage replaces the latest private summary and preserves a separate timestamped, redacted run summary. Revocation proof is `{projectRef,policyRevokedAt}` with an actual change within 30 minutes; merely writing the proof cannot make the application deny access.

After explicit readiness, the approved capture-export helper can be run in a separate terminal for up to ten minutes with `node scripts/hosted-preview/export-loop.mjs` and the same acceptance environment guard. It invokes the root-approved mailbox exporter with the exact reserved roster every two seconds, suppresses child stdout/stderr and writes only a small status receipt privately. The underlying exporter independently rechecks the live capture-only proof. It does not trigger email or create accounts.

## Secret handling and limitations

All credentials originate in the ignored local fixture. Real MFA enrollment responses are written directly to ignored `mfa.json`; the verifier reads that file, calculates and stores a current TOTP, then reads it for the actual UI verification. Traces, video, screenshots, HTML reports and raw error reporting are disabled. Do not use Playwright debug modes or override the reporter/artifact settings. No browser storage snapshots or bearer tokens are exported by this suite. Its reporter emits only static test names, status and duration.

Shared-IP MFA, reset and logout actions are paced at no more than six requests in 300 seconds, using a conservative 301-second window. A wait can exceed several minutes across four roles; it does not bypass application limits. Concurrent operator Auth actions can still cause a genuine 429, which must be investigated rather than hidden.

The stages verify unselected consent, genuine signup/verification/login, onboarding and preferences, private account export, pause/recovery, social posting/reaction/comment/save/follow with separate alerts, private visibility, mute and bilateral block, cross-user mutation denial, official/verified spoof rejection, a plain colour swatch entering quarantine and actual MFA staff review, restricted-region denial, policy revocation, MFA and staff read/write boundaries, and revocation of a separately logged-in session after deletion. Hosted RLS/direct REST tests, advisor checks, retained audit inspection, final identity-erasure confirmation, rate/quota monitoring and deletion of remaining acceptance accounts belong to the provisioning operator's complementary workflow.

Supabase references checked before implementation: [PKCE/SSR flow](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp), [current changelog](https://supabase.com/changelog). No relevant Auth breaking change was identified in the current changelog; the installed SDK remains pinned.
