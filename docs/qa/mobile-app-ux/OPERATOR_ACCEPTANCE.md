# Isolated mobile UX account acceptance

Execution status: **final hosted acceptance passed all 15 views**, and the disposable account was erased on 3 October 2026 at 11:15 UTC. The [final matrix](hosted/2026-10-03T11-13-47-878Z/results.json) records zero accessibility violations and browser/runtime errors across 390, 412 and 1366px, including three genuine password-login/global-logout cycles. The [cleanup receipt](operator/cleanup.json) confirms owner-only Auth/profile/grant counts, unchanged owner fingerprints and closed service/data boundaries. Full-page and viewport screenshots are in the same final matrix folder. The first complete matrix and all earlier failures remain preserved.

`scripts/hosted-preview/mobile-ux-acceptance.ts` is an operator-only helper. It is not imported by the web app and never exposes a service secret to a browser. It uses a new private directory, preserving earlier acceptance journals and the owner's retained S24 account.

## Scope and safeguards

- Exact project `bckkllmndoxzpzdqrevb`, organization `ernfnkcbalhyqpsrzdwa`, `Docked Preview` name, and canonical HTTPS preview origin are required. Existing `auth-management.ps1 --inspect` independently verifies project identity through a read-only Management API request; it never changes configuration in this mode.
- The supplied operator environment must match the existing private connection record, verified TLS database target and full hosted-preview guard. Registration, sending, commercial features, polling, paper/live publication and provider credentials remain closed. Nine expected migrations, RLS, no sporting records, no delivery attempts and no broad jurisdiction approvals are checked before proceeding.
- Provisioning requires the owner-only Auth roster. It creates exactly one fresh reserved `example.invalid` account using Admin `createUser`, with operator confirmation explicitly distinguished from verified email ownership. It does not use signup, invite, recovery or email delivery endpoints.
- The public profile's age/terms fixture and consent event are explicitly labelled synthetic QA. A private social profile has no posts, follows or performance, and all notification channels are off. These fields never represent the owner or real-world consent.
- Its UUID receives only `community_social` and `public_profiles`, for at most four hours and no later than the existing approved preview-only policy's expiry/review deadline. The helper creates no policy and does not edit the policy shared with the owner.
- Owner critical Auth values, profile, social identity, consent, notification preferences, grants, policy and private credential-file bytes are fingerprinted before provisioning and checked afterward and during cleanup. They are never printed or changed.
- Errors emit fixed stage/checkpoint names and safe structural counts, never raw credential-bearing exceptions. Partial creation is retained in the new private journal; provisioning refuses to overwrite that journal. Cleanup reconciles the derived reserved email and operator-only run marker before touching its exact UUID. It can recover a partial run, including expired QA access.

## Commands

Run with the already verified private operator environment. Do not put credentials in command-line arguments or public logs. The environment must include the exact hosted preview flags, canonical `SITE_URL`, matching server-only database/Auth credentials and verified CA configuration. `--help` requires no credentials or network.

```powershell
node --conditions=react-server --import tsx scripts/hosted-preview/mobile-ux-acceptance.ts --help
node --conditions=react-server --import tsx scripts/hosted-preview/mobile-ux-acceptance.ts --plan
node --conditions=react-server --import tsx scripts/hosted-preview/mobile-ux-acceptance.ts --provision --confirm-project=bckkllmndoxzpzdqrevb
```

`--plan` performs read-only hosted checks and writes a sanitized local plan receipt. Provisioning writes only the new ignored `private-data/mobile-app-ux/provision-state.json` and `acceptance.json` files. The fixture contains `{ projectRef, organizationId, origin, qaFixture: true, disposable: true, runId, createdAt, expiresAt, member: { id, email, password } }`. No earlier credential or fixture file is overwritten.

After deployment, the separate browser runner can use the fixture for a genuine password login and read-only visits to Edges, Feed, Following, Points and My Edge. The account is deliberately empty: no sporting record or points balance is inserted for screenshots. Browser checks must distinguish unavailable/restricted performance from zero, preserve normal session and API authorization, and never use owner credentials.

The prepared runner uses Playwright and Axe from the installed dependencies:

```powershell
node --import tsx scripts/hosted-preview/mobile-ux-browser.ts --help
$env:DOCKED_MOBILE_UX_ACCEPTANCE = 'bckkllmndoxzpzdqrevb'
node --import tsx scripts/hosted-preview/mobile-ux-browser.ts --run
```

It independently validates the new run's reserved email, exact project/organization/origin, disposable marker, four-hour maximum grant and at least fifteen minutes remaining. Older QA identities and the retained owner cannot satisfy this contract. The browser receives no operator credentials. Cross-origin requests, credential-bearing query strings and every mutation except this disposable identity's normal login/logout are blocked. No trace, video, login screenshot, HTML dump or raw browser exception is retained.

The matrix uses 390 × 844, 412 × 915 and 1366 × 900 viewports with Australia/Sydney time and en-AU locale. Each viewport performs a genuine UI password login, verifies the returned own profile ID and secure HttpOnly session cookies, switches all five tabs, refreshes each directly, checks the active navigation, image decoding, font readiness, horizontal overflow, console/runtime errors and WCAG A/AA rules. It checks real empty feeds/relationships, visible official-region denial, unavailable performance, and disabled monthly/lifetime points without inserting content. Read-only APIs verify sporting records remain empty, the leaderboard remains restricted and administration is denied. Normal global logout must revoke the private export and restore the anonymous access gate.

Fifteen authenticated page/viewport results and both full-page and viewport screenshots are written to a new timestamped directory under `docs/qa/mobile-app-ux/hosted`. Captures happen only after authentication and credential-text checks. Failed runs retain their sanitized checkpoint/route/count receipt; no failure is silently converted into passing evidence. Two focused local guard regressions cover stale/wrong-account/wrong-target fixtures and request-boundary denials. The [first complete matrix](hosted/2026-10-03T11-05-36-501Z/results.json) retains overall FAIL for the two actual `.official-badge` contrast defects at 390/412px. No content was inserted to create those results: the affected suggestion is Docked's existing official profile. All three full-cycle console/runtime counters are zero.

Earlier attempts are preserved in their original timestamped folders. The first two encountered a harness assertion before the authenticated streaming fallback had yielded the destination heading; a third stopped during render readiness without a specific assertion diagnostic. The harness now waits for the actual destination body, detached loading branch and single heading before counting or capturing. A fourth reached the genuine Following accessibility defect. No product assertion was removed: security failures remain immediate, while visual findings are collected across the matrix and force an overall failure until repaired.

After every browser/native consumer has explicitly released the disposable account:

```powershell
node --conditions=react-server --import tsx scripts/hosted-preview/mobile-ux-acceptance.ts --cleanup --confirm-project=bckkllmndoxzpzdqrevb --qa-released
```

Cleanup uses the application's existing `private.disable_account` and `processAccountDeletion` flow: revoke sessions first, pseudonymise social data, delete Auth and personal profile data, then verify there are no target sessions, refresh tokens, grants, identifiable social content, media, notifications or analytics. The owner-only roster and closed service baseline are checked again. It leaves append-only pseudonymous audit evidence and the ordinary social tombstone intact. Only the new QA password copies are redacted; owner credentials, prior journals and the shared policy remain untouched.

Sanitized execution receipts, when actually run, are written to `docs/qa/mobile-app-ux/operator/{plan,provision,cleanup}.json`. A receipt is not written as success when the associated verification fails.

## Final hosted outcome

The canonical HTTPS preview was verified against deployment `dpl_J6UfdR9DPMx5YSkLjk93LHcPP1gn`, web source `6cd166187c30596d3f97d793606a2398adf6f43c`; see the [hosting audit](hosting-audit.json). The final browser result was recorded at 11:14:49 UTC. Each cell below includes a real authenticated tab switch, direct refresh, truthful empty/unavailable content, font and image readiness, overflow check, WCAG A/AA audit, and two screenshots.

| Destination | 390 × 844 | 412 × 915 | 1366 × 900 |
| --- | --- | --- | --- |
| Edges | PASS | PASS | PASS |
| Feed | PASS | PASS | PASS |
| Following | PASS | PASS | PASS |
| Points | PASS | PASS | PASS |
| My Edge | PASS | PASS | PASS |

All three contexts used genuine UI password login, secure HttpOnly session cookies, own-identity export verification, denied administrative access, restricted leaderboard data and empty official/provider projections. Both `following` and `for_you` feed APIs returned genuine ready/empty projections. Each context completed global logout and verified private export HTTP 401 plus the anonymous My Edge gate. Browser requests were restricted to the canonical frontend; only ordinary login/logout mutations were permitted. No profile, post, comment, follow, sporting or performance data was created by the browser.

The first full run's official suggestion exposed real mobile layout and contrast defects; those were repaired in CSS and independently tested with official/long-name fixtures before this successful hosted rerun. No accessibility rule was suppressed. All five earlier attempt folders remain available, including the complete pre-repair failure matrix.

Cleanup completed at 11:15:25 UTC through normal revocation, pseudonymisation and Auth erasure. The new disposable user's Auth record, sessions, refresh tokens, personal profile, grant, identifiable social linkage, media, notifications and analytics were checked absent. Its password copies were redacted in the new ignored private files. One retained owner Auth record, profile and grant remain; the owner's critical data and credential-file byte hashes match their pre-provisioning values. The shared preview policy was unchanged. Nine migrations remain applied with no unprotected application tables; zero ordinary jurisdiction approvals, staff roles, enabled commercial flags, capture/mail records, sporting events, odds, market references, official/community Edges or delivery attempts were recorded. Historical audit/tombstone records retain no identifying social content.

These results use real hosted backend sessions in Chromium at mobile and desktop viewport sizes. Physical Samsung S24 installation/interaction evidence belongs to the separate Android verification, not this browser result. The erased fixture cannot be reused for another run; a future disposable run requires a new explicitly reviewed private journal.

## Documentation checked

The [Supabase changelog](https://supabase.com/changelog), [server-only Admin createUser documentation](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [Admin deleteUser documentation](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) were checked during preparation. The implementation uses the project's installed client and existing TLS, Auth-erasure and Management inspection helpers. Deleting Auth alone is not treated as sufficient session revocation.
