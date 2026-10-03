# Isolated S24 HTTPS acceptance

This suite uses only the canonical HTTPS Vercel preview origin from `config/hosted-preview.json`, bound to Docked project `bckkllmndoxzpzdqrevb`. It never starts a local server, creates Auth users, calls provider APIs, changes cloud configuration or seeds sporting data. It has no relationship to the older loopback hosted-database suites in the parent directory.

Discovery is local and makes no requests:

```powershell
npx playwright test --config playwright.hosted.config.ts --list
```

After the root operator verifies the deployment is ready, opt in to anonymous read-only execution:

```powershell
$env:DOCKED_HTTPS_ACCEPTANCE='bckkllmndoxzpzdqrevb'
npx playwright test --config playwright.hosted.config.ts --project desktop --project mobile
```

The anonymous cases inspect genuine rendered routes at 1366px and 390px, API fail-closed states, signup's disabled UI, no production redirects, image decoding, overflow, browser console and Axe accessibility. Each route has its own timeout. Network idle is deliberately not used as a rendering assertion. Public screenshots and sanitized receipts go to `docs/qa/android-https-preview/hosted`. Actual HTML, RSC and JavaScript/CSS response bytes go only to ignored `private-data/android-preview/hosted/public-responses`, ready for `scripts/audit-preview-secrets.mjs`. Console payloads, request bodies and cookie values are never printed. No HAR, trace, video or automatic screenshot is retained.

Optional authenticated acceptance needs independently provisioned, disposable, verified Auth users in the same preview project. Registration remains closed. Store only in the ignored `private-data/android-preview/acceptance.json`, using `{ "projectRef": "bckkllmndoxzpzdqrevb", "qaFixture": true, "expiresAt": "operator-specified future ISO timestamp", "memberA": { "id": "...", "email": "docked-preview-...@example.invalid", "password": "..." }, "memberB": { "id": "...", "email": "docked-preview-...@example.invalid", "password": "...", "disposable": true } }`. The file must be less than 24 hours old and unexpired; identities must be distinct. Both accounts need completed QA onboarding, active time-limited social/profile tester grants, paused alerts off and no quiet interval. Marketing, external emails, native push, sporting tips and leaderboard eligibility remain off. The suite creates clearly labelled QA social profiles/posts through the actual UI and deletes its social post afterward. Root must clean up any failed-run residue and the ephemeral accounts. Operator-confirmed Auth users test account behavior, not email delivery or genuine user age/terms attestation.

```powershell
$env:DOCKED_HTTPS_AUTH_ACCEPTANCE='bckkllmndoxzpzdqrevb'
# Only when memberB is explicitly disposable and erasure is authorised:
$env:DOCKED_HTTPS_DELETE_MEMBER_B='bckkllmndoxzpzdqrevb'
npx playwright test --config playwright.hosted.config.ts --project authenticated
```

Authenticated execution is skipped without its separate opt-in. It covers genuine login, secure HttpOnly project cookies, persistence, profile creation, social publication, follower consent and in-app fanout without a worker, restricted direct APIs, own-only export, global logout and login again. Signup/recovery denial probes use only reserved invalid addresses. Deletion requires its own exact opt-in and verifies the session's exported ID is ephemeral memberB immediately before the request. A queued rather than completed erasure is a failure, reported for operator retry. Authenticated diagnostics and safe checkpoints remain in ignored private storage; no account password appears in public output. Do not point this fixture at a durable tester account.

For this reviewed run, the guard also requires the exact provisioned roster: `docked-preview-s24-qa-a-20261003@example.invalid` and `docked-preview-s24-qa-b-20261003@example.invalid`. A durable preview tester address cannot satisfy this check even if a private fixture is accidentally mislabeled.

Passing tests demonstrate the exercised state of this specific preview deployment, not production readiness, provider licensing, predictive edge or native device acceptance. The final APK must still be tested independently.

After the main authenticated journey, `--project member-evidence` performs one focused six-route mobile sweep using QA memberA: home, community, composer, profile, notifications and dashboard at 390px, plus home at 320px. It requires the authenticated PREVIEW label to remain visible and checks overflow. It captures real authenticated screenshots with any password fields masked, plus Axe/console checks; raw member HTML remains only in the ignored artifact directory. It does not delete or change account data. The three-project baseline is 31 cases; this separate sweep adds one case.

Before filling real disposable credentials, the login helper requires an explicit POST form bound to `/api/auth` and waits for its hydrated submission handler. Browser interception rejects password or access/refresh-token query parameters before network transmission. The separate local `tests/browser-hydration/auth-form-hydration.spec.ts` exercises delayed JavaScript and JavaScript-disabled native fallback using fictional credentials and intercepted requests; it never submits an authentication request to a real account.

After `npm run build`, run `npx playwright test --config playwright.hydration.config.ts`. Its isolated port 3107 refuses server reuse and explicitly disables database, server credentials, emails, providers and commercial features. Fictional loopback public auth configuration enables only the login UI for the intercepted request; the normal local preview intentionally leaves that UI disabled. No supplied real account or provider credential is used. Playwright owns and stops this test server.

The optional `--project timezone-evidence` is a focused follow-up for populated client-rendered timestamps. It uses QA memberA only, with browser timezone Australia/Sydney and locale en-AU. It creates one labelled disposable QA post and submits a comment through the actual UI, checks local timestamp text against the retained machine-readable instants, then removes both through the normal application APIs. It also requires a genuinely populated notification screen. If no actual notice remains, the operator may enqueue one explicitly labelled QA system notice through the existing in-app helper for exact QA A; this is declared in the receipt and is not represented as member activity. The suite never fabricates a notification row or sporting performance. It checks Axe, overflow and zero browser errors and captures populated screenshots. Do not rerun the full lifecycle against an already deleted memberB; preserve its completed deletion evidence and use this focused project for the rendering fix.
